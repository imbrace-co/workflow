import { BranchCondition, BranchExecutionType, BranchOperator, FlowActionType, FlowRunStatus, isNil, RouterAction, RouterActionSettings, RouterExecutionType, RouterStepOutput, StepOutputStatus } from '@activepieces/shared'
import dayjs from 'dayjs'
import { EngineGenericError } from '../helper/execution-errors'
import { utils } from '../utils'
import { BaseExecutor } from './base-executor'
import { EngineConstants } from './context/engine-constants'
import { FlowExecutorContext } from './context/flow-execution-context'
import { flowExecutor } from './flow-executor'
import { outboundOptions, resolveConfig, setRedisHash } from '../utils/message'

export const routerExecuter: BaseExecutor<RouterAction> = {
    async handle({
        action,
        executionState,
        constants,
    }) {
        const { censoredInput, resolvedInput } = await constants.propsResolver.resolve<RouterActionSettings>({
            unresolvedInput: {
                ...action.settings,
            },
            executionState,
        })

        const { type } = action;
        console.log(`Router Action Type: ${type}`);

        if (type === FlowActionType.MULTIPLE_CHOICE) {
            // Handle multiple choice specific logic
            console.log('Handling multiple choice execution');
            return handleMultipleChoiceQuestionExecution({ action, executionState, constants, censoredInput, resolvedInput })
        }

        switch (resolvedInput.executionType) {
            case RouterExecutionType.EXECUTE_ALL_MATCH:
                return handleRouterExecution({ action, executionState, constants, censoredInput, resolvedInput, routerExecutionType: RouterExecutionType.EXECUTE_ALL_MATCH })
            case RouterExecutionType.EXECUTE_FIRST_MATCH:
                return handleRouterExecution({ action, executionState, constants, censoredInput, resolvedInput, routerExecutionType: RouterExecutionType.EXECUTE_FIRST_MATCH })
            default:
                throw new EngineGenericError('RouterExecutionTypeNotSupportedError', `Router execution type ${resolvedInput.executionType} is not supported`)
        }
    },
}

async function handleMultipleChoiceQuestionExecution({ action, executionState, constants, censoredInput, resolvedInput }: {
    action: RouterAction
    executionState: FlowExecutorContext
    constants: EngineConstants
    censoredInput: unknown
    resolvedInput: RouterActionSettings
}): Promise<FlowExecutorContext> {


    try {
        const { name } = action;
        const { branches, question = "", saveAnswer, channelType = 'webwidget', executionType } = resolvedInput;
        console.log('Multiple choice question settings:', {
            name,
            branches,
            question,
            saveAnswer,
            channelType,
            executionType,
        });
        
        const options = branches.filter(b => b.branchType === BranchExecutionType.CONDITION).map(b => b.branchName);

        // Extract body from trigger execution state
        const triggerOutput = executionState.getStepOutput('trigger');
        const triggerBody = triggerOutput?.output as any;
        const body = triggerBody?.body;
        const immediate = triggerBody?.immediate;
        const position = triggerBody?.position;
        const state = triggerBody?.state;
        const ctx = body as Record<string, unknown> | undefined;

        console.log('Trigger body:', body);
        const conversation_id = ctx?.conversation_id as string | undefined;
        const content = ctx?.content as string | undefined;
        const from = ctx?.from as string | undefined;
        const type = ctx?.type as string | undefined;
        console.log('router ctx', {
            conversation_id, content, from, type, position, state, immediate
        });

        if (!conversation_id) {
            console.warn('[handleMultipleChoiceQuestionExecution] No conversation_id found in trigger body, skipping');
            return executionState;
        }

        let config = await resolveConfig(state, conversation_id);

        if (immediate) {
            const configData = {
                nodeName: name,
                state: config
            }
            await outboundOptions(channelType, question, resolvedInput, conversation_id, name);
            await setRedisHash('setWorkflowPosition', conversation_id, 'position', JSON.stringify(configData));
            return executionState;
        } else if (name === position) {


            const stepStartTime = performance.now()
            const evaluatedConditionsWithoutFallback = resolvedInput.branches.map((branch) => {
                return branch.branchType === BranchExecutionType.FALLBACK ? true : evaluateConditions(branch.conditions)
            })

            const evaluatedConditions = resolvedInput.branches.map((branch, index) => {
                if (branch.branchType === BranchExecutionType.CONDITION) {
                    return evaluatedConditionsWithoutFallback[index]
                }
                const fallback = evaluatedConditionsWithoutFallback.filter((_, i) => i !== index).every((condition) => !condition)
                return fallback
            })

            // Only remove position if at least one branch condition is met
            const hasMatchingCondition = evaluatedConditions.some(condition => condition === true);
            if (hasMatchingCondition) {
                await setRedisHash('removeWorkflowPosition', conversation_id, 'position', '');
            }
            const stepEndTime = performance.now()
            const routerOutput = RouterStepOutput.init({
                input: censoredInput,
            }).setOutput({
                branches: resolvedInput.branches.map((branch, index) => ({
                    branchName: branch.branchName,
                    branchIndex: index + 1,
                    evaluation: evaluatedConditions[index],
                })),
            }).setDuration(stepEndTime - stepStartTime)
            executionState = executionState.upsertStep(action.name, routerOutput)

            try {
                for (let i = 0; i < resolvedInput.branches.length; i++) {
                    const testSingleStepMode = !isNil(constants.stepNameToTest)
                    if (testSingleStepMode) {
                        break
                    }
                    const condition = routerOutput.output?.branches[i].evaluation
                    if (!condition) {
                        continue
                    }

                    executionState = await flowExecutor.execute({
                        action: action.children[i],
                        executionState,
                        constants,
                    })

                    const shouldBreakExecution = executionState.verdict.status !== FlowRunStatus.RUNNING || true
                    if (shouldBreakExecution) {
                        break
                    }
                }

               

                if (type === 'text') {
                     await outboundOptions(channelType, question, resolvedInput, conversation_id, name);
                }

                return executionState
            }
            catch (e ) {
                console.error(e)
                const failedStepOutput = routerOutput.setStatus(StepOutputStatus.FAILED)
                return executionState.upsertStep(action.name, failedStepOutput).setVerdict({ status: FlowRunStatus.FAILED, failedStep: {
                    name: action.name,
                    displayName: action.displayName,
                    message: utils.formatError(e as Error),
                } })
            }
        }
        return executionState;
    } catch (error) {
        console.error('[handleMultipleChoiceQuestionExecution] Error:', error);
        return executionState;
    }


}

async function handleRouterExecution({ action, executionState, constants, censoredInput, resolvedInput, routerExecutionType }: {
    action: RouterAction
    executionState: FlowExecutorContext
    constants: EngineConstants
    censoredInput: unknown
    resolvedInput: RouterActionSettings
    routerExecutionType: RouterExecutionType
}): Promise<FlowExecutorContext> {
    const stepStartTime = performance.now()

    const evaluatedConditionsWithoutFallback = resolvedInput.branches.map((branch) => {
        return branch.branchType === BranchExecutionType.FALLBACK ? true : evaluateConditions(branch.conditions)
    })

    const evaluatedConditions = resolvedInput.branches.map((branch, index) => {
        if (branch.branchType === BranchExecutionType.CONDITION) {
            return evaluatedConditionsWithoutFallback[index]
        }
        const fallback = evaluatedConditionsWithoutFallback.filter((_, i) => i !== index).every((condition) => !condition)
        return fallback
    })

    const stepEndTime = performance.now()
    const routerOutput = RouterStepOutput.init({
        input: censoredInput,
    }).setOutput({
        branches: resolvedInput.branches.map((branch, index) => ({
            branchName: branch.branchName,
            branchIndex: index + 1,
            evaluation: evaluatedConditions[index],
        })),
    }).setDuration(stepEndTime - stepStartTime)
    executionState = executionState.upsertStep(action.name, routerOutput)

    const { data: executionStateResult, error: executionStateError } = await utils.tryCatchAndThrowOnEngineError(async () => {
        for (let i = 0; i < resolvedInput.branches.length; i++) {
            if (!isNil(constants.stepNameToTest)) {
                break
            }
            const condition = routerOutput.output?.branches[i].evaluation
            if (!condition) {
                continue
            }
    
            executionState = await flowExecutor.execute({
                action: action.children[i],
                executionState,
                constants,
            })
    
            const shouldBreakExecution = executionState.verdict.status !== FlowRunStatus.RUNNING || routerExecutionType === RouterExecutionType.EXECUTE_FIRST_MATCH
            if (shouldBreakExecution) {
                break
            }
        }
        return executionState
    })
    if (executionStateError) {
        const failedStepOutput = routerOutput.setStatus(StepOutputStatus.FAILED)
        return executionState.upsertStep(action.name, failedStepOutput).setVerdict({ status: FlowRunStatus.FAILED, failedStep: {
            name: action.name,
            displayName: action.displayName,
            message: utils.formatError(executionStateError),
        } })
    }

    return executionStateResult
}


export function evaluateConditions(conditionGroups: BranchCondition[][]): boolean {
    let orOperator = false
    for (const conditionGroup of conditionGroups) {
        let andGroup = true
        for (const condition of conditionGroup) {
            const castedCondition = condition

            if (isNil(castedCondition.operator)) {
                throw new EngineGenericError('OperatorNotSetError', 'The operator is required but found to be undefined')
            }

            switch (castedCondition.operator) {
                case BranchOperator.TEXT_CONTAINS: {
                    const firstValueContains = toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive).includes(
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    andGroup = andGroup && firstValueContains
                    break
                }
                case BranchOperator.TEXT_DOES_NOT_CONTAIN: {
                    const firstValueDoesNotContain = !toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive).includes(
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    andGroup = andGroup && firstValueDoesNotContain
                    break
                }
                case BranchOperator.TEXT_EXACTLY_MATCHES: {
                    const firstValueExactlyMatches = toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive) ===
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive)
                    andGroup = andGroup && firstValueExactlyMatches
                    break
                }
                case BranchOperator.TEXT_DOES_NOT_EXACTLY_MATCH: {
                    const firstValueDoesNotExactlyMatch = toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive) !==
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive)
                    andGroup = andGroup && firstValueDoesNotExactlyMatch
                    break
                }
                case BranchOperator.TEXT_STARTS_WITH: {
                    const firstValueStartsWith = toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive).startsWith(
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    andGroup = andGroup && firstValueStartsWith
                    break
                }
                case BranchOperator.TEXT_ENDS_WITH: {
                    const firstValueEndsWith = toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive).endsWith(
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    andGroup = andGroup && firstValueEndsWith
                    break
                }
                case BranchOperator.TEXT_DOES_NOT_START_WITH: {
                    const firstValueDoesNotStartWith = !toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive).startsWith(
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    andGroup = andGroup && firstValueDoesNotStartWith
                    break
                }
                case BranchOperator.TEXT_DOES_NOT_END_WITH: {
                    const firstValueDoesNotEndWith = !toLowercaseIfCaseInsensitive(castedCondition.firstValue, castedCondition.caseSensitive).endsWith(
                        toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    andGroup = andGroup && firstValueDoesNotEndWith
                    break
                }
                case BranchOperator.LIST_CONTAINS: {
                    const list = parseAndCoerceListAsArray(castedCondition.firstValue)
                    andGroup = andGroup && list.some((item) =>
                        toLowercaseIfCaseInsensitive(item, castedCondition.caseSensitive) === toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    break
                }
                case BranchOperator.LIST_DOES_NOT_CONTAIN: {
                    const list = parseAndCoerceListAsArray(castedCondition.firstValue)
                    andGroup = andGroup && !list.some((item) =>
                        toLowercaseIfCaseInsensitive(item, castedCondition.caseSensitive) === toLowercaseIfCaseInsensitive(castedCondition.secondValue, castedCondition.caseSensitive),
                    )
                    break
                }
                case BranchOperator.NUMBER_IS_GREATER_THAN: {
                    const firstValue = parseStringToNumber(castedCondition.firstValue)
                    const secondValue = parseStringToNumber(castedCondition.secondValue)
                    andGroup = andGroup && firstValue > secondValue
                    break
                }
                case BranchOperator.NUMBER_IS_LESS_THAN: {
                    const firstValue = parseStringToNumber(castedCondition.firstValue)
                    const secondValue = parseStringToNumber(castedCondition.secondValue)
                    andGroup = andGroup && firstValue < secondValue
                    break
                }
                case BranchOperator.NUMBER_IS_EQUAL_TO: {
                    const firstValue = parseStringToNumber(castedCondition.firstValue)
                    const secondValue = parseStringToNumber(castedCondition.secondValue)
                    andGroup = andGroup && firstValue == secondValue
                    break
                }
                case BranchOperator.BOOLEAN_IS_TRUE:
                    andGroup = andGroup && !!castedCondition.firstValue
                    break
                case BranchOperator.BOOLEAN_IS_FALSE:
                    andGroup = andGroup && !castedCondition.firstValue
                    break
                case BranchOperator.DATE_IS_AFTER:
                    andGroup = andGroup && isValidDate(castedCondition.firstValue) && isValidDate(castedCondition.secondValue) && dayjs(castedCondition.firstValue).isAfter(dayjs(castedCondition.secondValue))
                    break
                case BranchOperator.DATE_IS_EQUAL:
                    andGroup = andGroup && isValidDate(castedCondition.firstValue) && isValidDate(castedCondition.secondValue) && dayjs(castedCondition.firstValue).isSame(dayjs(castedCondition.secondValue))
                    break
                case BranchOperator.DATE_IS_BEFORE:
                    andGroup = andGroup && isValidDate(castedCondition.firstValue) && isValidDate(castedCondition.secondValue) && dayjs(castedCondition.firstValue).isBefore(dayjs(castedCondition.secondValue))
                    break
                case BranchOperator.LIST_IS_EMPTY: {
                    const list = parseListAsArray(castedCondition.firstValue)
                    andGroup = andGroup && Array.isArray(list) && list?.length === 0
                    break
                }
                case BranchOperator.LIST_IS_NOT_EMPTY: {
                    const list = parseListAsArray(castedCondition.firstValue)
                    andGroup = andGroup && Array.isArray(list) && list?.length !== 0
                    break
                }
                case BranchOperator.EXISTS:
                    andGroup = andGroup && castedCondition.firstValue !== undefined && castedCondition.firstValue !== null && castedCondition.firstValue !== ''
                    break
                case BranchOperator.DOES_NOT_EXIST:
                    andGroup = andGroup && (castedCondition.firstValue === undefined || castedCondition.firstValue === null || castedCondition.firstValue === '')
                    break
            }
        }
        orOperator = orOperator || andGroup
    }
    return Boolean(orOperator)
}

function toLowercaseIfCaseInsensitive(text: unknown, caseSensitive: boolean | undefined): string {
    if (typeof text === 'string') {
        return caseSensitive ? text : text.toLowerCase()
    }
    const textAsString = JSON.stringify(text)
    return caseSensitive ? textAsString : textAsString.toLowerCase()
}

function parseStringToNumber(str: string): number | string {
    const num = Number(str)
    return isNaN(num) ? str : num
}

function parseListAsArray(input: unknown): unknown[] | undefined {
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input)
            return Array.isArray(parsed) ? parsed : undefined
        }
        catch (e) {
            return undefined
        }
    }
    return Array.isArray(input) ? input : undefined
}

function parseAndCoerceListAsArray(input: unknown): unknown[] {
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input)
            return Array.isArray(parsed) ? parsed : [parsed]
        }
        catch (e) {
            return [input]
        }
    }
    return Array.isArray(input) ? input : [input]
}

function isValidDate(date: unknown): boolean {
    if (typeof date === 'string' || typeof date === 'number' || date instanceof Date) {
        return dayjs(date).isValid()
    }
    return false
}