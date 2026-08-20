'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { ApStorage } from '@/lib/ap-browser-storage';
import { foldersHooks } from '@/features/folders/lib/folders-hooks';
import {
  buildCategoryMetadata,
  isAiAgentCategory,
  isChannelWorkflowCategory,
  AI_AGENT_CAPABILITIES,
  CHANNEL_WORKFLOW_FOLDER,
} from '@/features/folders/lib/category-utils';
import { useBuilderStateContext, LeftSideBarType } from '../builder-hooks';
import { FlowOperationType } from '@activepieces/shared';

import ParameterPropertyForm from './WorkflowSetting/parameterPropertyForm';
import EnhancedTableHead from './WorkflowSetting/Table/TableHead';
import TableRow from './WorkflowSetting/Table/TableRow';

import type {
  ParameterProperty,
  ParameterPropertyFormData,
  Mode,
} from './WorkflowSetting';

interface FlowSettingsFormValue {
  workflowName: string;
  category: string;
  capabilityDescription: string;
  mode: Mode;
  directResponse: boolean;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE' | '';
  parameterProperties: Record<string, ParameterProperty>;
}

export const FlowSettings = () => {
  const { t } = useTranslation();
  const organizationId = ApStorage.getInstance().getItem('organization_id');

  const [flow, applyOperation, moveToFolderClientSide, setLeftSidebar] =
    useBuilderStateContext((state) => [
      state.flow,
      state.applyOperation,
      state.moveToFolderClientSide,
      state.setLeftSidebar,
    ]);

  const { folders } = foldersHooks.useFolders();

  const [loading, setLoading] = useState(false);
  const [confirmBasicModeOpen, setConfirmBasicModeOpen] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState<(() => void) | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ParameterProperty | null>(
    null,
  );
  const [importedWorkflowSettingByJSON, setImportedWorkflowSettingByJSON] =
    useState('');

  const workflowSetting = flow.metadata?.settings as any;

  // Determine current category from folder
  const currentFolderId = flow.folderId || '';
  const currentFolderName = (() => {
    if (!currentFolderId || !folders) return '';
    const folder = folders.find((f) => f.id === currentFolderId);
    return folder ? folder.displayName : '';
  })();

  const form = useForm<FlowSettingsFormValue>({
    defaultValues: {
      workflowName: flow.version.displayName || '',
      category: currentFolderName || '',
      capabilityDescription:
        workflowSetting?.ai?.function?.description || '',
      mode: workflowSetting?.ai?.function?.mode || 'basic',
      directResponse:
        workflowSetting?.ai?.function?.is_direct_response || false,
      method: workflowSetting?.ai?.function?.method || '',
      parameterProperties: {},
    },
  });

  const {
    control,
    setValue,
    getValues,
    watch,
  } = form;

  const watchCategory = watch('category');
  const watchMode = watch('mode');
  const watchWorkflowName = watch('workflowName');
  const watchCapabilityDescription = watch('capabilityDescription');
  const watchMethod = watch('method');
  const parameterProperties = watch('parameterProperties');

  const isChannelWorkflow = isChannelWorkflowCategory(currentFolderName);
  const isAiCategory = isAiAgentCategory(watchCategory);

  // Check if all required fields are filled
  const isFormComplete = (() => {
    if (!watchWorkflowName) return false;
    if (!isChannelWorkflow && !watchCategory) return false;
    if (isAiCategory) {
      if (!watchCapabilityDescription) return false;
      if (watchMode === 'basic' && !watchMethod) return false;
    }
    return true;
  })();

  // Initialize form values from existing flow data
  useEffect(() => {
    setValue('workflowName', flow.version.displayName || '');

    if (currentFolderName) {
      setValue('category', currentFolderName);
    }

    if (workflowSetting?.ai?.function) {
      const aiFunction = workflowSetting.ai.function;
      setValue('capabilityDescription', aiFunction.description || '');
      setValue('mode', aiFunction.mode || 'basic');
      setValue('directResponse', aiFunction.is_direct_response || false);
      setValue('method', aiFunction.method || '');

      setImportedWorkflowSettingByJSON(
        JSON.stringify(aiFunction, null, 2),
      );

      // Convert parameters
      if (aiFunction.parameters?.properties) {
        const convertedProperties = Object.entries(
          aiFunction.parameters.properties,
        ).reduce(
          (acc, [key, value]: [string, any]) => ({
            ...acc,
            [key]: {
              name: key,
              type: value.type,
              description: value.description,
              required:
                aiFunction.parameters.required?.includes(key) || false,
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
          {},
        );
        setValue('parameterProperties', convertedProperties);
      }
    }
  }, [
    flow.version.displayName,
    flow.folderId,
    currentFolderName,
    workflowSetting?.ai?.function,
  ]);

  const updateData = (field: keyof FlowSettingsFormValue, value: any) => {
    setValue(field, value, { shouldValidate: true, shouldDirty: true });
  };

  const openPropertyDialog = (item?: ParameterProperty) => {
    setEditingItem(item || null);
    setDialogOpen(true);
  };

  const handleDialogConfirm = (formData: ParameterPropertyFormData) => {
    if (editingItem) {
      const currentProperties = getValues('parameterProperties');
      const { [editingItem.name]: removedProperty, ...remainingProperties } =
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
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleDeleteField = (item: ParameterProperty) => {
    const newProperties = Object.entries(parameterProperties)
      .filter(([_, property]) => property.name !== item.name)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    updateData('parameterProperties', newProperties);
  };

  const handleClose = () => {
    setLeftSidebar(LeftSideBarType.NONE);
  };

  const saveFlow = async () => {
    const values = getValues();
    setLoading(true);
    try {
      // Update flow name if changed
      if (values.workflowName !== flow.version.displayName) {
        applyOperation({
          type: FlowOperationType.CHANGE_NAME,
          request: { displayName: values.workflowName },
        });
      }

      // Move to folder based on category
      if (values.category && folders) {
        const targetFolder = folders.find(
          (f) =>
            f.displayName.toLowerCase() === values.category.toLowerCase(),
        );
        if (targetFolder && targetFolder.id !== flow.folderId) {
          applyOperation({
            type: FlowOperationType.CHANGE_FOLDER,
            request: { folderId: targetFolder.id },
          });
          moveToFolderClientSide(targetFolder.id);
        }
      }

      // Build AI config if AI category
      let aiConfig:
        | { description: string; settings: { ai: any } }
        | undefined;

      if (isAiCategory) {
        if (values.mode === 'basic') {
          const formParameters = values.parameterProperties;
          const aiFunction = {
            ...(workflowSetting?.ai?.function || {}),
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
            settings: {
              ai: { type: 'function', function: aiFunction },
            },
          };
        } else {
          // Advanced mode
          try {
            const json = JSON.parse(importedWorkflowSettingByJSON);
            const aiFunction = {
              ...(workflowSetting?.ai?.function || {}),
              mode: 'advanced',
              organization_id: organizationId,
              ...(json.name && { name: json.name }),
              description: json.description || values.capabilityDescription,
              ...(json.method && { method: json.method }),
              ...(json.parameters && { parameters: json.parameters }),
            };
            aiConfig = {
              description: values.capabilityDescription,
              settings: {
                ai: { type: 'function', function: aiFunction },
              },
            };
          } catch {
            toast({
              title: t('Error'),
              description: t('Invalid JSON configuration'),
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
        }
      }

      // Build metadata using shared utility
      let updatedMetadata: any;
      if (isChannelWorkflow) {
        // Channel workflow: preserve existing metadata as-is
        updatedMetadata = { ...flow.metadata };
      } else {
        updatedMetadata = buildCategoryMetadata(
          values.category,
          flow.metadata,
          aiConfig,
        );
      }

      applyOperation({
        type: FlowOperationType.UPDATE_METADATA,
        request: { metadata: updatedMetadata },
      });

      toast({
        title: t('Success'),
        description: t('Flow settings saved successfully'),
      });

      handleClose();
    } catch (err) {
      console.error('Error saving flow settings:', err);
      toast({
        title: t('Error'),
        description: t('Failed to save flow settings. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderTableRow = (item: ParameterProperty, index: number) => {
    return (
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
  };

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
    <div className="w-full h-full bg-background border-r">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('Flow Settings')}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Form {...form}>
          <div className="flex flex-col gap-4 pl-2 pr-4 overflow-y-auto max-h-[calc(100vh-160px)]">
            {/* Workflow Name */}
            <FormField
              name="workflowName"
              control={control}
              rules={{ required: t('Workflow name is required') }}
              render={({ field, fieldState: { error } }) => (
                <FormItem>
                  <FormLabel>{t('Workflow Name*')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('Enter workflow name')}
                      className={error ? 'border-destructive' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              name="category"
              control={control}
              rules={{ required: t('Category is required') }}
              render={({ field, fieldState: { error } }) => (
                <FormItem>
                  <FormLabel>{t('Category')} *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isChannelWorkflow}
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
                            disabled={
                              folder.displayName === CHANNEL_WORKFLOW_FOLDER &&
                              !isChannelWorkflow &&
                              !!currentFolderName
                            }
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

            {/* AI Configuration - only when AI Agent Capabilities is selected */}
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
                              setImportedWorkflowSettingByJSON(
                                JSON.stringify(
                                  workflowSetting?.ai?.function,
                                  null,
                                  2,
                                ),
                              );
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
                    {/* Direct Response checkbox */}
                    <Controller
                      name="directResponse"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="directResponse"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <Label htmlFor="directResponse">
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
                  <div className="flex flex-col gap-4">
                    <Textarea
                      className="w-full min-h-[200px]"
                      value={importedWorkflowSettingByJSON}
                      onChange={(e) => {
                        setImportedWorkflowSettingByJSON(e.target.value);
                      }}
                      placeholder={t('Enter JSON configuration...')}
                    />
                  </div>
                )}
              </>
            )}

            {/* Footer */}
            <div className="flex justify-end mt-2 mb-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        className="w-40"
                        disabled={loading || !isFormComplete}
                        onClick={saveFlow}
                      >
                        {loading ? t('Saving...') : t('Save')}
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
            <div className="flex justify-end gap-2">
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Property dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                setDialogOpen(false);
                setEditingItem(null);
              }}
              parameterProperties={parameterProperties}
              t={t}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
