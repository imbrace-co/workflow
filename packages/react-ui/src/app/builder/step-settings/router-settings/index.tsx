import { useReactFlow } from '@xyflow/react';
import { t } from 'i18next';
import { Split } from 'lucide-react';
import { memo, useEffect } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import {
  FlowActionType,
  FlowOperationRequest,
  FlowOperationType,
  flowStructureUtil,
  FlowVersion,
  isNil,
  RouterAction,
  RouterExecutionType,
} from '@activepieces/shared';

import { FormField, FormItem, FormMessage } from '../../../../components/ui/form';
import { Label } from '../../../../components/ui/label';
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '../../../../components/ui/select';
import { useBuilderStateContext } from '../../builder-hooks';
import { flowCanvasUtils } from '../../flow-canvas/utils/flow-canvas-utils';
import { BranchSettings } from '../branch-settings';
import { FLOW_BUILDER_CONSTANTS } from '../../constants';

import { BranchesList } from './branches-list';
import BranchesToolbar from './branches-toolbar';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { TextInputWithMentions } from '../../piece-properties/text-input-with-mentions';

// Maximum number of branches allowed for MULTIPLE_CHOICE based on channel type
const getMaxBranchesForChannel = (channelType: string): number => {
  return FLOW_BUILDER_CONSTANTS.MAX_MULTIPLE_CHOICE_BRANCHES[channelType as keyof typeof FLOW_BUILDER_CONSTANTS.MAX_MULTIPLE_CHOICE_BRANCHES]
    || FLOW_BUILDER_CONSTANTS.MAX_MULTIPLE_CHOICE_BRANCHES.default;
};

export const RouterSettings = memo(({ readonly, isMultipleChoice }: { readonly: boolean, isMultipleChoice: boolean }) => {
  const [
    step,
    flow,
    applyOperation,
    setSelectedBranchIndex,
    selectedBranchIndex,
    addOperationListener,
    removeOperationListener,
  ] = useBuilderStateContext((state) => [
    flowStructureUtil.getActionOrThrow(
      state.selectedStep!,
      state.flowVersion.trigger,
    ) as RouterAction,
    state.flow,
    state.applyOperation,
    state.setSelectedBranchIndex,
    state.selectedBranchIndex,
    state.addOperationListener,
    state.removeOperationListener,
  ]);
  const { fitView } = useReactFlow();

  const { metadata } = flow;

  // Determine default channel type based on flow metadata tags
  const getDefaultChannelType = () => {
    if (metadata?.tags && Array.isArray(metadata.tags)) {
      const tagNames = metadata.tags.map((tag: any) => tag.name?.toLowerCase());
      if (tagNames.includes('whatsapp')) {
        return 'whatsapp';
      }
      if (tagNames.includes('web')) {
        return 'webwidget';
      }
      if (tagNames.includes('facebook')) {
        return 'facebook';
      }
    }
    return 'webwidget'; // fallback default
  };

  const { control, setValue, formState, watch } =
    useFormContext<Omit<RouterAction, 'children' | 'nextAction'>>();

  // Watch for changes in channel type to apply appropriate branch limits
  const channelType = watch('settings.channelType') || getDefaultChannelType();
  const maxBranches = getMaxBranchesForChannel(channelType);

  // Count only condition branches (exclude fallback branches from limits)
  const conditionBranchCount = step.settings.branches.filter(
    branch => branch.branchType !== 'FALLBACK'
  ).length;

  //To validate array items we need to use form.trigger()
  const { insert, remove, move } = useFieldArray({
    control,
    name: 'settings.branches',
  });
  const form = useFormContext<Omit<RouterAction, 'children' | 'nextAction'>>();

  const deleteBranch = (index: number) => {
    applyOperation({
      type: FlowOperationType.DELETE_BRANCH,
      request: {
        stepName: step.name,
        branchIndex: index,
      },
    });

    setSelectedBranchIndex(null);
    fitView(flowCanvasUtils.createFocusStepInGraphParams(step.name));
  };

  useEffect(() => {
    const operationListener = (
      flowVersion: FlowVersion,
      operation: FlowOperationRequest,
    ) => {
      switch (operation.type) {
        case FlowOperationType.DELETE_BRANCH: {
          if (operation.request.stepName !== step.name) {
            return;
          }
          remove(operation.request.branchIndex);
          break;
        }
        case FlowOperationType.DUPLICATE_BRANCH:
        case FlowOperationType.ADD_BRANCH: {
          if (operation.request.stepName !== step.name) return;
          const updatedStep = flowStructureUtil.getActionOrThrow(
            operation.request.stepName,
            flowVersion.trigger,
          );
          if (updatedStep.type !== FlowActionType.ROUTER && updatedStep.type !== FlowActionType.MULTIPLE_CHOICE) {
            console.error(
              `Trying to duplicate a branch on a none router step! ${operation.request.stepName}`,
            );
            return;
          }

          // Check branch limit for MULTIPLE_CHOICE
          if (updatedStep.type === FlowActionType.MULTIPLE_CHOICE) {
            const currentConditionBranchCount = updatedStep.settings.branches.filter(
              branch => branch.branchType !== 'FALLBACK'
            ).length;
            const stepChannelType = updatedStep.settings.channelType || 'webwidget';
            const stepMaxBranches = getMaxBranchesForChannel(stepChannelType);
            if (currentConditionBranchCount >= stepMaxBranches) {
              console.warn(`Maximum of ${stepMaxBranches} branches allowed for Multiple Choice with ${stepChannelType} channel`);
              return;
            }
          }

          const branch =
            updatedStep.settings.branches[operation.request.branchIndex];
          if (operation.type === FlowOperationType.DUPLICATE_BRANCH) {
            insert(operation.request.branchIndex + 1, {
              ...branch,
              branchName: `${branch.branchName} Copy`,
            });
          } else {
            insert(
              updatedStep.settings.branches.length - 1,
              flowStructureUtil.createBranch(
                `Branch ${updatedStep.settings.branches.length}`,
                undefined,
              ),
            );
          }
          form.trigger();
          break;
        }
        case FlowOperationType.MOVE_BRANCH: {
          if (operation.request.stepName !== step.name) return;
          move(
            operation.request.sourceBranchIndex,
            operation.request.targetBranchIndex,
          );
          break;
        }
      }
    };

    addOperationListener(operationListener);
    return () => removeOperationListener(operationListener);
  }, []);

  return (
    <>
      {isNil(selectedBranchIndex) && (
        <FormField
          control={control}
          name="settings.executionType"
          render={({ field }) => (
            <FormItem>
              <Label>{t('Execute')}</Label>
              <Select
                disabled={field.disabled}
                onValueChange={field.onChange}
                value={field.value}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Execute')} />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem
                    value={`${RouterExecutionType.EXECUTE_FIRST_MATCH}`}
                  >
                    {t('Only the first (left) matching branch')}
                  </SelectItem>
                  <SelectItem
                    value={`${RouterExecutionType.EXECUTE_ALL_MATCH}`}
                  >
                    {t('All matching paths from left to right')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        ></FormField>
      )}

      {
        isMultipleChoice && isNil(selectedBranchIndex) && (
          <>
            {/* <FormField control={control} name="settings.source"
              rules={{
                required: t('Source is required'),
              }}
              render={({ field }) => (
                <FormItem>
                  <Label className='text-destructive' htmlFor='settings.source'>{t('Source')} *</Label>
                  <TextInputWithMentions
                    placeholder={t('Select the source of the question')}
                      onChange={(value) => {
                      field.onChange(value);
                      form.trigger();
                    }}
                    initialValue={field.value}
                  />
                  <FormMessage />

                </FormItem>
              )} /> */}
            <FormField control={control} name="settings.channelType"
              rules={{
                required: t('Channel Type is required'),
              }}
              render={({ field }) => (
                <FormItem>
                  <Label className='text-destructive' htmlFor='settings.channelType'>{t('Channel Type')} *</Label>
                  <Select
                    disabled={field.disabled || readonly}
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={getDefaultChannelType()}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('Channel Type')} />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem
                        value="webwidget"
                      >
                        {t('Web Widget')}
                      </SelectItem>
                      <SelectItem
                        value="whatsapp"
                      >
                        {t('Whatsapp')}
                      </SelectItem>
                      <SelectItem
                        value="facebook"
                      >
                        {t('Facebook')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            <FormField control={control} name="settings.question"
              rules={{
                required: t('Question is required'),
              }}
              render={({ field }) => (
                <FormItem>
                  <Label className='text-destructive' htmlFor='settings.question'>{t('Question')} *</Label>
                  <TextInputWithMentions
                    placeholder={t('Type your question')}
                    onChange={(value) => {
                      field.onChange(value);
                      form.trigger();
                    }}
                    initialValue={field.value || ''}
                    disabled={readonly}
                  />
                  <FormMessage />

                </FormItem>
              )} />
            <FormField
              control={control}
              name="settings.saveAnswer"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2 p-1">
                    <Switch
                      disabled={readonly}
                      id="saveAnswer"
                      checked={field.value}
                      onCheckedChange={(e) => field.onChange(e)}
                    />
                    <Label htmlFor="saveAnswer">{t('Save Answer')}</Label>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

      {isNil(selectedBranchIndex) && (
        <div className="mt-4">
          <div className="flex gap-2 mb-2 items-center">
            <Split className="w-4 h-4 rotate-180"></Split>
            <Label>{t('Branches')}</Label>
          </div>

          <BranchesList
            errors={(formState.errors.settings?.branches as unknown[]) ?? []}
            readonly={readonly}
            step={step}
            isMultipleChoice={isMultipleChoice}
            disableDuplicate={isMultipleChoice && conditionBranchCount >= maxBranches}
            channelType={channelType}
            maxBranches={maxBranches}
            branchNameChanged={(index, name) => {
              setValue(`settings.branches.${index}.branchName` as const, name, {
                shouldValidate: true,
              });
            }}
            deleteBranch={deleteBranch}
            moveBranch={({ sourceIndex, targetIndex }) => {
              applyOperation({
                type: FlowOperationType.MOVE_BRANCH,
                request: {
                  stepName: step.name,
                  sourceBranchIndex: sourceIndex,
                  targetBranchIndex: targetIndex,
                },
              });
            }}
            duplicateBranch={(index) => {
              // Check branch limit for MULTIPLE_CHOICE before duplicating
              if (isMultipleChoice && conditionBranchCount >= maxBranches) {
                console.warn(`Maximum of ${maxBranches} branches allowed for Multiple Choice with ${channelType} channel`);
                return;
              }

              applyOperation({
                type: FlowOperationType.DUPLICATE_BRANCH,
                request: {
                  stepName: step.name,
                  branchIndex: index,
                },
              });
              setSelectedBranchIndex(index + 1);
            }}
            setSelectedBranchIndex={(index) => {
              setSelectedBranchIndex(index);
              if (step.children[index]) {
                fitView(
                  flowCanvasUtils.createFocusStepInGraphParams(
                    step.children[index].name,
                  ),
                );
              } else {
                fitView(
                  flowCanvasUtils.createFocusStepInGraphParams(
                    `${step.name}-big-add-button-${step.name}-branch-${index}-start-edge`,
                  ),
                );
              }
            }}
          ></BranchesList>
          {!readonly && (
            <div className="mt-2">
              <BranchesToolbar
                disabled={isMultipleChoice && conditionBranchCount >= maxBranches}
                channelType={channelType}
                currentBranches={conditionBranchCount}
                maxBranches={maxBranches}
                addButtonClicked={() => {
                  // Check branch limit for MULTIPLE_CHOICE before adding
                  if (isMultipleChoice && conditionBranchCount >= maxBranches) {
                    console.warn(`Maximum of ${maxBranches} branches allowed for Multiple Choice with ${channelType} channel`);
                    return;
                  }

                  applyOperation({
                    type: FlowOperationType.ADD_BRANCH,
                    request: {
                      stepName: step.name,
                      branchIndex: step.settings.branches.length - 1,
                      branchName: `Branch ${step.settings.branches.length}`,
                    },
                  });

                  setSelectedBranchIndex(step.settings.branches.length - 1);
                }}
              ></BranchesToolbar>
            </div>
          )}
        </div>
      )}

      {!isNil(selectedBranchIndex) && (
        <BranchSettings
          readonly={readonly}
          key={`settings.branches[${selectedBranchIndex}].conditions`}
          branchIndex={selectedBranchIndex}
        ></BranchSettings>
      )}
    </>
  );
});

RouterSettings.displayName = 'RouterSettings';
