import { IBoard } from './types';

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

export function isObject(value: any) {
	return !!value && typeof value === 'object' && Object.keys(value).length > 0;
}

export function getFieldIdMap(board: IBoard) {
	const fieldIdMap: Record<string, string> = {};
	board.fields.forEach((field) => (fieldIdMap[field.name] = field._id));
	return fieldIdMap;
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

export const handleOperationError = (errorMsg: string) => {
	throw Error(errorMsg);
};

export const handleFieldDataError = (errorMsg: string) => {
	// TODO: thinking of a better way to display error messages
	// if (!item.json.board_operation_error) Object.assign(item.json, { board_operation_error: {} });
	// const errorObject = {
	// 	id: `${nodeName}`,
	// 	name: `${icsTitle}`,
	// 	message: `${errorMsg}`,
	// };
	// (item.json.board_operation_error as GenericValue[])?.push(errorObject);
	return null;
};

export const handleString = (fieldValue: string, allowError: boolean): string => {
	if (fieldValue === null) {
		// return 'null' when null
		if (allowError) return String(fieldValue);
		handleOperationError(errorMessages.needToAddValue);
	}

	// object but not empty
	if (isObject(fieldValue)) {
		return JSON.stringify(fieldValue);
	}
	return fieldValue.toString() || '';
};

export const validEmptyString = (
  inputString: string,
  isIdentifier = true
): string => {
  if (typeof inputString === 'string') inputString = inputString.trim();

  if (inputString === '' || inputString === undefined || inputString === null) {
    const message = isIdentifier
      ? `Please confirm that the value in the 'Identifier' is filled in and valid`
      : `Please confirm that the values in the parameters are filled in and valid`;
    handleOperationError(message); // never -> không cần return
  }

  return inputString;
};


export const processItemFields = (content: string | object, board: IBoard, action: string) => {
	const itemFields: any[] = [];

	const fieldIdMap = getFieldIdMap(board);

	content = typeof content === 'string' ? JSON.parse(content) : content;

	Object.entries(content).forEach(([k, v]) => {
		const fieldIdKey = Object.keys(fieldIdMap).find(key => key === k);
		const fieldIdValue = Object.values(fieldIdMap).find(value => value === k);

		if (fieldIdKey || fieldIdValue) {
			itemFields.push({
				[action === 'create' ? 'board_field_id' : 'key']: fieldIdKey ? fieldIdMap[k] : k,
				value: v,
			});
		}
	});

	return itemFields;
};

export const processItemFields_MultiAssignees = (content: string | object, board: IBoard, action: string) => {
	const itemFields: any[] = [];

	const fieldIdMap = getFieldIdMap(board);

	content = typeof content === 'string' ? JSON.parse(content) : content;

	Object.entries(content).forEach(([k, v]) => {
		const fieldIdKey = Object.keys(fieldIdMap).find(key => key === k);
		const fieldIdValue = Object.values(fieldIdMap).find(value => value === k);

		if (fieldIdKey || fieldIdValue) {
			if (Array.isArray(v)) {
				v.forEach(item => {
					itemFields.push({
						[action === 'create' ? 'board_field_id' : 'key']: fieldIdKey ? fieldIdMap[k] : k,
						value: item,
					});
				});
			} else {
				itemFields.push({
					[action === 'create' ? 'board_field_id' : 'key']: fieldIdKey ? fieldIdMap[k] : k,
					value: v,
				});
			}
		}
	});

	return itemFields;
};

export const checkIfAdditionalFieldsExists = (additionalFields: {
	[key: string]: Record<string, string>[];
}) => {
	if (Object.keys(additionalFields).length === 0 || additionalFields['actionPairs'].length === 0) {
		handleOperationError(errorMessages.needToAddValue);
	}
};
