'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { foldersHooks } from '@/features/folders/lib/folders-hooks';
import {
  buildCategoryMetadata,
  isAiAgentCategory,
  AI_AGENT_CAPABILITIES,
  CHANNEL_WORKFLOW_FOLDER,
} from '@/features/folders/lib/category-utils';
import { ApStorage } from '@/lib/ap-browser-storage';

import ParameterPropertyForm from '@/app/builder/flow-settings/WorkflowSetting/parameterPropertyForm';
import EnhancedTableHead from '@/app/builder/flow-settings/WorkflowSetting/Table/TableHead';
import TableRow from '@/app/builder/flow-settings/WorkflowSetting/Table/TableRow';

import type {
  ParameterProperty,
  ParameterPropertyFormData,
  Mode,
} from '@/app/builder/flow-settings/WorkflowSetting';

interface CreateFlowSettingsFormValue {
  category: string;
  capabilityDescription: string;
  mode: Mode;
  directResponse: boolean;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE' | '';
  parameterProperties: Record<string, ParameterProperty>;
}

export interface CreateFlowSettingsResult {
  folderName: string;
  metadata: Record<string, unknown>;
}

interface CreateFlowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory: string;
  onConfirm: (result: CreateFlowSettingsResult) => void;
}

export const CreateFlowSettingsDialog = ({
  open,
  onOpenChange,
  defaultCategory,
  onConfirm,
}: CreateFlowSettingsDialogProps) => {
  const { t } = useTranslation();
  const organizationId = ApStorage.getInstance().getItem('organization_id');
  const { folders } = foldersHooks.useFolders();

  const [confirmBasicModeOpen, setConfirmBasicModeOpen] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState<(() => void) | null>(null);
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ParameterProperty | null>(
    null,
  );
  const [importedWorkflowSettingByJSON, setImportedWorkflowSettingByJSON] =
    useState('');

  const form = useForm<CreateFlowSettingsFormValue>({
    defaultValues: {
      category: defaultCategory || '',
      capabilityDescription: '',
      mode: 'basic',
      directResponse: false,
      method: '',
      parameterProperties: {},
    },
  });

  const { control, setValue, getValues, watch } = form;

  const watchCategory = watch('category');
  const watchMode = watch('mode');
  const watchCapabilityDescription = watch('capabilityDescription');
  const watchMethod = watch('method');
  const parameterProperties = watch('parameterProperties');

  const isAiCategory = isAiAgentCategory(watchCategory);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        category: defaultCategory || '',
        capabilityDescription: '',
        mode: 'basic',
        directResponse: false,
        method: '',
        parameterProperties: {},
      });
      setImportedWorkflowSettingByJSON('');
    }
  }, [open, defaultCategory]);

  const isFormComplete = (() => {
    if (!watchCategory) return false;
    if (isAiCategory) {
      if (!watchCapabilityDescription) return false;
      if (watchMode === 'basic' && !watchMethod) return false;
    }
    return true;
  })();

  const updateData = (
    field: keyof CreateFlowSettingsFormValue,
    value: any,
  ) => {
    setValue(field, value, { shouldValidate: true, shouldDirty: true });
  };

  const openPropertyDialog = (item?: ParameterProperty) => {
    setEditingItem(item || null);
    setPropertyDialogOpen(true);
  };

  const handleDialogConfirm = (formData: ParameterPropertyFormData) => {
    if (editingItem) {
      const currentProperties = getValues('parameterProperties');
      const { [editingItem.name]: _, ...remainingProperties } =
        currentProperties;
      updateData('parameterProperties', {
        ...remainingProperties,
        [formData.name]: {
          ...formData,
          enum: formData.enum
            ? formData.enum.split(',').map((item) => item.trim())
            : [],
        },
      });
    } else {
      const { name, type, description, required, items, enum: enumValues } =
        formData;
      updateData('parameterProperties', {
        ...getValues('parameterProperties'),
        [name]: {
          name,
          type,
          description,
          required,
          items,
          enum: enumValues
            ? enumValues.split(',').map((item) => item.trim())
            : [],
        },
      });
    }
    setPropertyDialogOpen(false);
    setEditingItem(null);
  };

  const handleDeleteField = (item: ParameterProperty) => {
    const newProperties = Object.entries(parameterProperties)
      .filter(([_, property]) => property.name !== item.name)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    updateData('parameterProperties', newProperties);
  };

  const handleConfirm = () => {
    const values = getValues();

    // Build AI config if AI category
    let aiConfig:
      | { description: string; settings: { ai: any } }
      | undefined;

    if (isAiCategory) {
      if (values.mode === 'basic') {
        const formParameters = values.parameterProperties;
        const aiFunction = {
          mode: 'basic',
          is_direct_response: values.directResponse,
          description: values.capabilityDescription,
          method: values.method,
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
              {},
            ),
            required: Object.entries(formParameters)
              .filter(([_, value]) => value.required)
              .map(([key]) => key),
          },
        };
        aiConfig = {
          description: values.capabilityDescription,
          settings: { ai: { type: 'function', function: aiFunction } },
        };
      } else {
        // Advanced mode
        try {
          const json = JSON.parse(importedWorkflowSettingByJSON);
          const aiFunction = {
            mode: 'advanced',
            organization_id: organizationId,
            ...(json.name && { name: json.name }),
            description: json.description || values.capabilityDescription,
            ...(json.method && { method: json.method }),
            ...(json.parameters && { parameters: json.parameters }),
          };
          aiConfig = {
            description: values.capabilityDescription,
            settings: { ai: { type: 'function', function: aiFunction } },
          };
        } catch {
          return; // Invalid JSON, don't proceed
        }
      }
    }

    // Build metadata using shared utility
    const metadata = buildCategoryMetadata(values.category, {}, aiConfig);

    onConfirm({
      folderName: values.category,
      metadata,
    });
    onOpenChange(false);
  };

  const renderTableRow = (item: ParameterProperty, index: number) => (
    <TableRow
      key={item.name || `new-field-${index}`}
      item={item}
      openDialog={(item) => openPropertyDialog(item)}
      handleDeleteField={() => handleDeleteField(item)}
      onCheck={(val) =>
        updateData('parameterProperties', {
          ...getValues('parameterProperties'),
          [item.name]: { ...item, required: val },
        })
      }
    />
  );

  const renderListProperty = () => {
    if (Object.values(parameterProperties).length > 0) {
      return (
        <div className="border rounded-md">
          <EnhancedTableHead />
          <Table>
            <TableBody>
              {Object.values(parameterProperties).map((item, index) =>
                renderTableRow(item, index),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Flow Settings')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <div className="flex flex-col gap-4 mt-2">
            {/* Category */}
            <FormField
              name="category"
              control={control}
              rules={{ required: t('Category is required') }}
              render={({ field, fieldState: { error } }) => (
                <FormItem>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={error ? 'border-destructive' : ''}
                      >
                        <SelectValue
                          placeholder={t('Select category')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(folders || []).map((folder) => (
                          <SelectItem
                            key={folder.id}
                            value={folder.displayName}
                          >
                            {t(folder.displayName)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AI Configuration - only when AI Agent Capabilities */}
            {isAiCategory && (
              <>
                <Separator />
                <h3 className="text-lg font-semibold">
                  {t('AI Configuration')}
                </h3>

                {/* Capability Description */}
                <FormField
                  name="capabilityDescription"
                  control={control}
                  rules={{
                    required: isAiCategory
                      ? t('Capability description is required')
                      : false,
                  }}
                  render={({ field, fieldState: { error } }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Skill Description')} *
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t(
                            'Describe what this skill does and when the AI should use it. E.g., "Retrieve available time slots to help customers book appointments."',
                          )}
                          className={`placeholder:text-muted-foreground/50 ${error ? 'border-destructive' : ''}`}
                          minRows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Mode */}
                <FormField
                  name="mode"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Mode')}*</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value: Mode) => {
                          if (
                            value === 'basic' &&
                            field.value === 'advanced'
                          ) {
                            setPendingModeChange(() => () => {
                              field.onChange(value);
                              setImportedWorkflowSettingByJSON('');
                            });
                            setConfirmBasicModeOpen(true);
                          } else {
                            field.onChange(value);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('Select Mode')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem
                            value="basic"
                            description={t(
                              'Fill in only the required fields. The system will generate the JSON for the AI.',
                            )}
                          >
                            {t('BASIC')}
                          </SelectItem>
                          <SelectItem
                            value="advanced"
                            description={t(
                              'Import and use your own JSON for the AI.',
                            )}
                          >
                            {t('ADVANCED')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {watchMode === 'basic' && (
                  <>
                    {/* Direct Response */}
                    <Controller
                      name="directResponse"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="createFlowDirectResponse"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <Label htmlFor="createFlowDirectResponse">
                            {t('AI reply directly with results')}
                          </Label>
                        </div>
                      )}
                    />

                    {/* Method */}
                    <Controller
                      name="method"
                      control={control}
                      rules={{ required: t('Method is required') }}
                      render={({ field, fieldState: { error } }) => (
                        <FormItem>
                          <Label>{t('Method')}*</Label>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t('Select')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="DELETE">
                                DELETE
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {error && (
                            <p className="text-sm text-destructive mt-1">
                              {error.message}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    {/* Parameters */}
                    <div className="flex flex-col gap-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        {t('Parameters')}
                      </h4>
                      <div className="max-h-[200px] overflow-y-auto">
                        {renderListProperty()}
                      </div>
                      <Button
                        variant="link"
                        onClick={() => openPropertyDialog()}
                        className="justify-start p-0 h-auto"
                      >
                        {t('Add Property')}
                      </Button>
                    </div>
                  </>
                )}

                {watchMode === 'advanced' && (
                  <Textarea
                    className="w-full min-h-[200px]"
                    value={importedWorkflowSettingByJSON}
                    onChange={(e) =>
                      setImportedWorkflowSettingByJSON(e.target.value)
                    }
                    placeholder={t('Enter JSON configuration...')}
                  />
                )}
              </>
            )}

            {/* Footer */}
            <div className="flex justify-end mt-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        disabled={!isFormComplete}
                        onClick={handleConfirm}
                      >
                        {t('Confirm')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isFormComplete && (
                    <TooltipContent>
                      <p>
                        {t('Please complete all required fields')}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </Form>

        {/* Confirm basic mode dialog */}
        <Dialog
          open={confirmBasicModeOpen}
          onOpenChange={(open) => {
            setConfirmBasicModeOpen(open);
            if (!open) setPendingModeChange(null);
          }}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>
                {t('Do you want to change to basic mode? All changes will be lost.')}
              </DialogTitle>
            </DialogHeader>
            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmBasicModeOpen(false);
                  setPendingModeChange(null);
                }}
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={() => {
                  pendingModeChange?.();
                  setConfirmBasicModeOpen(false);
                  setPendingModeChange(null);
                }}
              >
                {t('OK')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Property dialog */}
        <Dialog
          open={propertyDialogOpen}
          onOpenChange={setPropertyDialogOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingItem
                  ? t('Edit Property')
                  : t('Add New Property')}
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
                setPropertyDialogOpen(false);
                setEditingItem(null);
              }}
              parameterProperties={parameterProperties}
              t={t}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
