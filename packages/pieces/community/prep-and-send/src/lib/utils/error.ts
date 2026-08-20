import { ActionContext } from '@activepieces/pieces-framework';
import { 
    setWorkflowOutputHistory, 
    removeWorkflowPosition, 
    removeWorkflowOutputHistory 
} from './general-function';

export class WorkflowError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WorkflowError';
    }
}

interface ErrorMessages<T extends string> {
	serverSideError: T;
	positionError: T;
	positionNonRetrievableError: T;
	historyNonRetrievableError: T;
	needToAddValue: T;
	fieldIsRequired: (fieldName: string) => T;
	wrongType: (fieldValue: string, correctType: string) => T;
	wrongFormatOfDate: (fieldValue: string) => T;
	wrongFormatOfTime: (fieldValue: string) => T;
	wrongValue: (fieldName: string, correctValues: string) => T;
	wrongValueInMultipleSelection: (fieldName: string, correctValues: string) => T;
	shortTextCharLimit: (fieldName: string) => T;
	fieldNotFound: (fieldValue: string) => T;
}

export const errorMessages: ErrorMessages<string> = {
	serverSideError: 'Server Side Error: Missing conversation id or connector name or item',
	positionError: 'Server Side Error: Invalid position',
	positionNonRetrievableError:
		'Server Side Non-retrievable Error: Position cannot be equal with nodeName',
	historyNonRetrievableError: 'Server Side Non-retrievable Error: Invalid Workflow History',
	needToAddValue: `Please set at least one set of values in "Action Settings"`,
	fieldIsRequired: (fieldName: string) =>
		`'${fieldName}' field is required, please ensure this field is filled with a value`,
	wrongType: (fieldValue: string, correctType: string) =>
		`Wrong type of "${fieldValue}", please change to ${correctType}`,
	wrongFormatOfDate: (fieldValue: string) =>
		`Wrong format of "${fieldValue}", please change to this format: 2020/01/01`,
	wrongFormatOfTime: (fieldValue: string) =>
		`Wrong format of "${fieldValue}", please change to this format: 12:30`,
	wrongValue: (fieldName: string, correctValues: string) =>
		`Please enter the correct value in the "${fieldName}" field, should be one of the [${correctValues}]`,
	wrongValueInMultipleSelection: (fieldName: string, correctValues: string) =>
		`Please enter the correct values in the "${fieldName}" field and separate by comma, it should match any of [${correctValues}]`,
	shortTextCharLimit: (fieldName: string) =>
		`The "${fieldName}" field is "Short Text" type, the text input should less than 150 character`,
	fieldNotFound: (fieldValue: string) => `Can not find the field of ${fieldValue}`,
};

/**
 * @param ctx The Activepieces ActionContext
 * @param errorMessage The error string
 * @param data The data object (item.json equivalent)
 * @param nodeName Current node name
 * @param hasFallback Set to true to return data for branching; false to throw and cleanup.
 */
export const handleWorkflowError = async (
    ctx: ActionContext,
    errorMessage: string,
    data: any,
    nodeName: string,
    hasFallback = true // Type annotation removed to satisfy eslint
) => {
    const conversation_id = data?.conversation_id as string;

    if (!conversation_id || !nodeName || !data) {
        throw new WorkflowError('Server Side Error: Missing conversation id or node name');
    }

    if (hasFallback) {
        // PATH 1: FALLBACK (n8n returnData.length !== 1)
        data.error = errorMessage;
        data.success = false;

        try {
            // Index "1" represents the second output/fallback path
            const fallbackIndex = "1"; 
            await setWorkflowOutputHistory(conversation_id, nodeName, fallbackIndex);
            
            console.log(`[${nodeName}] Handled Error: ${errorMessage}`);
            return data; 
        } catch (error: any) {
            throw new WorkflowError(error.message);
        }
    } else {
        // PATH 2: FATAL (n8n else/throw path)
        await removeWorkflowPosition(conversation_id);
        await removeWorkflowOutputHistory(conversation_id, nodeName);
        
        throw new WorkflowError(errorMessage);
    }
};