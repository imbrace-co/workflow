'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { useBuilderStateContext } from '../builder-hooks';
import { FlowStatus } from '../../../../../shared/src/lib/flows/flow';
import { FlowOperationType } from '../../../../../shared/src/lib/flows/operations';
import { ApStorage } from '@/lib/ap-browser-storage';
export interface WorkflowInfoFormValue {
  workflowName: string;
  description: string;
  runWithAI: boolean;
}

export const WorkflowInfo = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();

  const [flow, applyOperation] = useBuilderStateContext((state) => [
    state.flow,
    state.applyOperation,
  ]);
  
  const [workflowSettings, setWorkflowSettings] = useState<any>(
    flow.metadata?.settings || {}
  );

  const saveCurrentWorkflow = async (data: any) => {
    const savedWorkflowSettings = workflowSettings;
    if(savedWorkflowSettings?.ai?.function){
      savedWorkflowSettings.ai.function.description = data.description;
    }
    try {
      // Update flow metadata with the new settings
      const updatedMetadata = {
        ...flow.metadata,
        description: data.description,
        settings: {
          ...(flow.metadata?.settings || {}),
          ai: data.runWithAI ? savedWorkflowSettings?.ai : undefined,
        },
      };
      console.log("Begin call api update metadata");
      // Apply the UPDATE_METADATA operation
      applyOperation({
        type: FlowOperationType.UPDATE_METADATA,
        request: {
          metadata: updatedMetadata,
        },
      });

      // Update flow name if changed
      if (data.name !== flow.version.displayName) {
        applyOperation({
          type: FlowOperationType.CHANGE_NAME,
          request: {
            displayName: data.name,
          },
        });
      }
      console.log('Workflow updated successfully:', data);
      return true;
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw error;
    }
  };

  const organizationId = ApStorage.getInstance().getItem('organization_id');

  const [loading, setLoading] = useState(false);
  console.log({flow})

  useEffect(() => {
    setValue('workflowName', flow.version.displayName);
    setValue('description', flow.metadata?.description as string);
    setValue('runWithAI', (flow.metadata?.settings as any)?.ai?.function ? true : false);
  }, [flow.version.displayName, flow.metadata?.description, flow.metadata?.settings]);

  const form = useForm<WorkflowInfoFormValue>({
    defaultValues: {
      workflowName: '',
      description: '',
      runWithAI: false,
    },
  });

  const {
    control,
    setValue,
    getValues,
    setError,
    handleSubmit,
    formState: { isDirty, isValid },
  } = form;

  const onUpdateWorkflow = async () => {
    await saveCurrentWorkflow(
      {
        name: getValues('workflowName'),
        description: getValues('description'),
        runWithAI: getValues('runWithAI'),
      },
    );
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      console.log('onSubmit', getValues());
      await onUpdateWorkflow();
      onClose?.();
    } catch (err) {
      console.error('Error updating workflow:', err);
      toast({
        title: t('Error'),
        description: 'Create workflow failed. Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4 mt-4 px-6">
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

        <FormField
          name="description"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormItem>
              <FormLabel>{t('Description')}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={t('Enter workflow description')}
                  className={error ? 'border-destructive' : ''}
                  minRows={6}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="runWithAI"
          control={control}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-end gap-2">
                <div className="flex items-center space-x-2">
                  <FormControl>
                    <Checkbox
                      id="runWithAI"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          if (!getValues('description')) {
                            toast({
                              title: t('Error'),
                              description:
                                t('Please enter a description for the workflow'),
                              variant: 'destructive',
                            });
                            return;
                          }
                          const currentSettings = workflowSettings || {};
                          const aiFunction = {
                            ...(currentSettings?.ai?.function || {}),
                            mode:
                              currentSettings?.ai?.function?.mode || 'basic',
                            is_direct_response:
                              currentSettings?.ai?.function
                                ?.is_direct_response || false,
                            description:
                              currentSettings?.ai?.function?.description ||
                              getValues('description'),
                            method:
                              currentSettings?.ai?.function?.method || 'POST',
                            organization_id:
                              currentSettings?.ai?.function?.organization_id ||
                              organizationId,
                            parameters: currentSettings?.ai?.function
                              ?.parameters || {
                              type: 'object',
                              properties: {},
                              required: [],
                            },
                          };
                          setWorkflowSettings({
                            ...currentSettings,
                            ai: {
                              ...(currentSettings?.ai || {}),
                              function: aiFunction,
                            },
                          });
                        } else {
                          // When unchecked, remove AI settings
                          const currentSettings = workflowSettings || {};
                          const { ai, ...restSettings } = currentSettings;
                          setWorkflowSettings(restSettings);
                        }
                        field.onChange(checked);
                      }}
                    />
                  </FormControl>
                  <FormLabel htmlFor="runWithAI">{t('Run With AI')}</FormLabel>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />


        <div className="flex justify-end mt-8">
          <Button
            className="w-40"
            disabled={loading || !isDirty || !isValid}
            onClick={handleSubmit(onSubmit)}
          >
            {loading ? t('Saving...') : t('Save')}
          </Button>
        </div>
      </div>
    </Form>
  );
};
