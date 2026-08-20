'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { TFunction } from 'i18next';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

import { ApStorage } from '@/lib/ap-browser-storage';
import { useBuilderStateContext } from '../../builder-hooks';
import { FlowOperationType } from '@activepieces/shared';
import styles from './index.module.scss';
import ParameterPropertyForm from './parameterPropertyForm';
import EnhancedTableHead from './Table/TableHead';
import TableRow from './Table/TableRow';

export type ParameterPropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object';

export type Mode = 'basic' | 'advanced';

export interface ParameterProperty {
  name: string;
  type: ParameterPropertyType;
  description?: string;
  required?: boolean;
  items?: {
    type: 'string' | 'number' | 'boolean';
    description: string;
  };
  enum?: string[];
}

export interface ParameterPropertyFormData {
  description?: string;
  type: ParameterPropertyType;
  items?: {
    type: string;
    description: string;
  };
  enum?: string;
  required?: boolean;
  name: string;
}

export const parameterPropertySchema = ({
  t,
  existFields,
  checkDuplicate = true,
}: {
  t: TFunction<'translation', undefined>;
  existFields?: ParameterProperty[];
  checkDuplicate?: boolean;
}) =>
  z
    .object({
      description: z
        .string()
        .max(
          100,
          t('validation_input_description_maxlength', {
            max: 100,
          })
        )
        .optional(),
      type: z.enum(
        ['string', 'number', 'boolean', 'array', 'object'] as const,
        {
          required_error: t('validation_field_required'),
        }
      ),
      items: z
        .object({
          type: z.string(),
          description: z.string(),
        })
        .optional(),
      enum: z.string().optional(),
      required: z.boolean().optional(),
      name: z
        .string({ required_error: t('validation_field_required') })
        .superRefine((val, ctx) => {
          if (!val || val.length < 1 || val.trim().length <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('validation_field_required'),
              fatal: true,
            });

            return z.NEVER;
          }
          if (checkDuplicate) {
            const uniqueValues = new Map<string, number>();
            existFields?.forEach((field, idx) => {
              uniqueValues.set(field.name.toLocaleLowerCase(), idx);
            });
            const firstAppearanceIndex = uniqueValues.get(
              val.toLocaleLowerCase()
            );
            if (firstAppearanceIndex !== undefined) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t('error_field_name_exists'),
                fatal: true,
              });
              return z.NEVER;
            }
          }
        }),
    })
    .required({
      type: true,
      name: true,
    }) as z.ZodType<ParameterPropertyFormData>;

export interface WorkflowSettingFormValue {
  description: string;
  directResponse: boolean;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  parameterProperties: Record<string, ParameterProperty>;
}

export const WorkflowSetting = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  // Toast functions will be handled by the toast hook
  const [mode, setMode] = useState<Mode>('basic');
  const organizationId = ApStorage.getInstance().getItem('organization_id');

  const [flow, flowVersion, selectedStep, applyOperation] = useBuilderStateContext((state) => [
    state.flow,
    state.flowVersion,
    state.selectedStep,
    state.applyOperation,
  ]);

  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ParameterProperty | null>(
    null
  );
  const [importedWorkflowSettingByJSON, setImportedWorkflowSettingByJSON] =
    useState('');

  const workflowSetting = flow.metadata?.settings as any;

  const {
    control,
    setValue,
    getValues,
    watch,
    handleSubmit,
    formState: { isDirty, isValid },
    setError,
    reset,
  } = useForm<WorkflowSettingFormValue>({
    defaultValues: {
      description: '',
      directResponse: false,
      method: 'POST',
      parameterProperties: {},
    },
  });

  const parameterProperties = watch('parameterProperties');

  const saveBasicModeWorkflowSetting = async () => {
    try {
      // Convert form parameters back to API format
      const formParameters = getValues('parameterProperties');
      const aiFunction = {
        ...(workflowSetting?.ai?.function || {}),
        mode: 'basic',
        is_direct_response: getValues('directResponse'),
        description: getValues('description') || '',
        method: getValues('method'),
        organization_id: organizationId,
        parameters: {
          type: 'object',
          properties: Object.entries(formParameters).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: {
                type: value.type,
                description: value.description,
                items:
                  value.type === 'array' && value.items
                    ? {
                        type: value.items.type,
                        description: value.items.description,
                      }
                    : undefined,
                enum: value.enum ? value.enum : [],
              },
            }),
            {}
          ),
          required: Object.entries(formParameters)
            .filter(([_, value]) => value.required)
            .map(([key]) => key),
        },
      };

      // Update flow metadata with the new AI settings
      const updatedMetadata = {
        ...flow.metadata,
        settings: {
          ...(flow.metadata?.settings || {}),
          ai: {
            type: 'function',
            function: aiFunction,
          },
        },
      };

      // Apply the UPDATE_METADATA operation
      applyOperation({
        type: FlowOperationType.UPDATE_METADATA,
        request: {
          metadata: updatedMetadata,
        },
      });

      console.log('Workflow settings saved successfully:', updatedMetadata);
      return true;
    } catch (error) {
      console.error('Error saving workflow settings:', error);
      throw error;
    }
  };

  const saveAdvancedModeWorkflowSetting = async () => {
    try {
      const aiFunction = {
        ...(workflowSetting?.ai?.function || {}),
        mode: 'advanced',
        organization_id: organizationId,
      };
      const json = JSON.parse(importedWorkflowSettingByJSON);
      if (json.name) {
        aiFunction.name = json.name;
      }
      aiFunction.description = json.description;
      if (json.method) {
        aiFunction.method = json.method;
      }
      if (json.parameters) {
        aiFunction.parameters = json.parameters;
      }

      // Update flow metadata with the new AI settings
      const updatedMetadata = {
        ...flow.metadata,
        settings: {
          ...(flow.metadata?.settings || {}),
          ai: {
            type: 'function',
            function: aiFunction,
          },
        },
      };

      // Apply the UPDATE_METADATA operation
      applyOperation({
        type: FlowOperationType.UPDATE_METADATA,
        request: {
          metadata: updatedMetadata,
        },
      });

      console.log('Advanced workflow settings saved successfully:', updatedMetadata);
      return true;
    } catch (error) {
      console.error('Error saving advanced workflow settings:', error);
      throw error;
    }
  };

  const updateData = (field: keyof WorkflowSettingFormValue, value: any) => {
    setValue(field, value, { shouldValidate: true, shouldDirty: true });
  };

  useEffect(() => {
    if (workflowSetting) {
      const settings = workflowSetting;
      setImportedWorkflowSettingByJSON(
        JSON.stringify(settings?.ai?.function, null, 2)
      );
      const mode = settings?.ai?.function.mode ?? 'basic';
      setMode(mode);
      if (mode === 'advanced') return;
      if (settings && settings.ai?.function) {
        const aiFunction = settings.ai.function;
        const { description, parameters, method, is_direct_response } =
          aiFunction;
        updateData('description', description);
        updateData('method', method);
        updateData('directResponse', is_direct_response);
        // Convert parameters format to ParameterProperty format
        if (parameters.properties) {
          const convertedProperties = Object.entries(
            parameters.properties
          ).reduce(
            (acc, [key, value]: [string, any]) => ({
              ...acc,
              [key]: {
                name: key,
                type: value.type as 'string' | 'number' | 'boolean' | 'array',
                description: value.description,
                required: parameters.required?.includes(key) || false,
                items:
                  value.type === 'array' && value.items
                    ? {
                        type: value.items.type,
                        description: value.items.description,
                      }
                    : undefined,
                enum: value.enum,
              },
            }),
            {}
          );
          updateData('parameterProperties', convertedProperties);
        }
      }
    }
  }, [workflowSetting?.ai?.function]);

  const openDialog = (item?: ParameterProperty) => {
    setEditingItem(item || null);
    setDialogOpen(true);
  };

  const handleDialogConfirm = (formData: ParameterPropertyFormData) => {
    if (editingItem) {
      // Edit existing property
      const currentProperties = getValues('parameterProperties');
      const { [editingItem.name]: removedProperty, ...remainingProperties } =
        currentProperties;
      updateData('parameterProperties', {
        ...remainingProperties,
        [formData.name]: {
          ...formData,
          enum: formData.enum
            ? formData.enum.split(',').length > 0
              ? formData.enum.split(',').map((item) => item.trim())
              : [formData.enum]
            : [],
        },
      });
    } else {
      // Add new property
      const {
        name,
        type,
        description,
        required,
        items,
        enum: enumValues,
      } = formData;
      updateData('parameterProperties', {
        ...getValues('parameterProperties'),
        [name]: {
          name,
          type,
          description,
          required,
          items,
          enum: enumValues
            ? enumValues.split(',').length > 0
              ? enumValues.split(',').map((item) => item.trim())
              : [enumValues]
            : [],
        },
      });
    }
    setDialogOpen(false);
    setEditingItem(null);
  };

  const onSubmit = () => async () => {
    setLoading(true);
    try {
      if (mode === 'basic') {
        await saveBasicModeWorkflowSetting();
      } else {
        await saveAdvancedModeWorkflowSetting();
      }
      toast({
        title: t('Success'),
        description: t('Workflow settings saved successfully'),
      });
      onClose?.();
    } catch (err) {
      toast({
        title: t('Error'),
        description: t('workflow_setting_update_workflow_setting_failed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteField = (item: ParameterProperty) => {
    const newProperties = Object.entries(parameterProperties)
      .filter(([_, property]) => property.name !== item.name)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    updateData('parameterProperties', newProperties);
  };

  const renderTableRow = (item: ParameterProperty, index: number) => {
    return (
      <TableRow
        key={item.name || `new-field-${index}`}
        item={item}
        openDialog={(item) => openDialog(item)}
        handleDeleteField={() => handleDeleteField(item)}
        onCheck={(val) =>
          updateData('parameterProperties', {
            ...getValues('parameterProperties'),
            [item.name]: { ...item, required: val },
          })
        }
      />
    );
  };

  const renderListProperty = () => {
    if (Object.values(parameterProperties).length > 0) {
      return (
        <div className="border rounded-md">
          <EnhancedTableHead />
          <Table>
            <TableBody>
              {Object.values(parameterProperties).map((item, index) =>
                renderTableRow(item, index)
              )}
            </TableBody>
          </Table>
        </div>
      );
    }
    return (
      <div className="text-center w-full text-muted-foreground py-4">
        {t('No properties added')}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 mt-4 px-6 max-h-[calc(100vh-200px)] overflow-hidden">
      <div className="mb-4">
        <Label htmlFor="mode-select">{t('Mode')}</Label>
        <Select
          value={mode}
          onValueChange={(value: Mode) => {
            if (value === 'basic') {
              // Show confirmation dialog
              if (
                confirm(
                  t('Do you want to change to basic mode? All changes will be lost.')
                )
              ) {
                setMode(value);
                setImportedWorkflowSettingByJSON(
                  JSON.stringify(workflowSetting?.ai?.function, null, 2)
                );
              }
            } else {
              setMode(value);
            }
          }}
        >
          <SelectTrigger id="mode-select" className="w-full">
            <SelectValue placeholder={t('Select Mode')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              value="basic"
              description={t('Fill in only the required fields. The system will generate the JSON for the AI.')}
            >
              {t('BASIC')}
            </SelectItem>
            <SelectItem
              value="advanced"
              description={t('Import and use your own JSON for the AI.')}
            >
              {t('ADVANCED')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? t('Edit Property') : t('Add New Property')}
            </DialogTitle>
          </DialogHeader>
          <ParameterPropertyForm
            editingItem={
              editingItem
                ? {
                    ...editingItem,
                    enum: editingItem.enum?.join(',') || '',
                  }
                : null
            }
            onConfirm={handleDialogConfirm}
            onCancel={() => {
              setDialogOpen(false);
              setEditingItem(null);
            }}
            parameterProperties={parameterProperties}
            t={t}
          />
        </DialogContent>
      </Dialog>

      <Separator />
      {mode === 'basic' && (
        <div className="flex flex-col gap-0 flex-1 min-h-0">
          <div className="flex flex-col gap-4 mt-4 flex-shrink-0">
            <Controller
              name="directResponse"
              control={control}
              render={({ field }) => (
                <div className="flex flex-row justify-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="directResponse"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <Label htmlFor="directResponse">{t('Direct Response')}</Label>
                  </div>
                </div>
              )}
            />
          </div>
          <div className="flex flex-col gap-4 mt-4 flex-shrink-0">
            <Controller
              name="method"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <div className={styles.boardDesc}>
                  <Label htmlFor="method-select">{t('Method')}*</Label>
                  <Select {...field} onValueChange={field.onChange}>
                    <SelectTrigger id="method-select" className="w-full">
                      <SelectValue placeholder={t('Workflow Method')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                  {error && (
                    <p className="text-sm text-destructive mt-1">
                      {error.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
          <div className="flex flex-col gap-3 mt-6 w-full flex-1 min-h-0">
            <h4 className="text-sm font-semibold text-muted-foreground flex-shrink-0">
              {t('Parameters')}
            </h4>
            <div className="flex-1 overflow-y-auto max-h-[300px]">
              {renderListProperty()}
            </div>
            <Button
              variant="link"
              onClick={() => openDialog()}
              className="justify-start p-0 h-auto flex-shrink-0"
            >
              {t('Add Property')}
            </Button>
          </div>
          <div className="flex justify-end mt-8 flex-shrink-0">
            <Button
              className="w-40"
              disabled={loading || !isDirty || !isValid}
              onClick={handleSubmit(onSubmit())}
            >
              {loading ? t('Saving...') : t('Save')}
            </Button>
          </div>
        </div>
      )}
      {mode === 'advanced' && (
        <div className="flex flex-col gap-4 mt-8">
          <Textarea
            className="w-full min-h-[200px]"
            value={importedWorkflowSettingByJSON}
            onChange={(e) => {
              setImportedWorkflowSettingByJSON(e.target.value);
            }}
            placeholder={t('Enter JSON configuration...')}
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit(onSubmit())} disabled={loading}>
              {loading ? t('Saving...') : t('Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
