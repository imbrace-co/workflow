import moment from 'moment';
import { handleString } from '../common/general-functions';
import { formatPhoneNumberWithCountryCallingCode } from '.';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { redisExpire, redisHSet } from './redis';
import { CHANNEL_BASE, LEGACY_APPS_BASE } from '../common/api';

export type BoardType =
  | 'Contacts'
  | 'Companies'
  | 'Opportunities'
  | 'Tasks'
  | 'Products'
  | 'General'
  | 'OptOut'
  | 'System'
  | 'KnowledgeHub';

export interface IDataPair {
  value: string;
  _id: string;
}

export interface IBoardField {
  _id: string;
  name: string;
  type: string;
  is_default: boolean;
  default_field_name: string;
  hidden: boolean;
  data: IDataPair[];
  [key: string]: string | boolean | IDataPair[];
}

export interface IBoard {
  _id: string;
  doc_name: string;
  business_unit_id: string;
  organization_id: string;
  name: string;
  description: string;
  type: BoardType;
  fields: IBoardField[];
  [key: string]: string | IBoardField[];
}
export function isDate(value: any) {
  return isNaN(value) && !isNaN(Date.parse(value));
}

export function convertDateToISOString(value: any) {
  return moment(value).seconds(0).toISOString();
}
export function isNumber(value: any) {
  return typeof value === 'number' && !isNaN(+value);
}

export function convertToNumber(value: any) {
  return +value;
}

export function convertStringToArray(inputString: string) {
  return inputString
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getBoardFieldById(board: IBoard, fieldId: string) {
  return (
    board.fields.find((field: IBoardField) => field._id === fieldId) || null
  );
}

export function getIdentifierField(board: IBoard) {
  return board.fields.find((field) => field['is_identifier']);
}

export const getFilterName = (board: IBoard, fieldId: string) => {
  const boardField = getBoardFieldById(board, fieldId);
  if (boardField?.type === 'Assignee') return `${fieldId}._id`;
  if (boardField?.type === 'Phone')
    return `${fieldId}.calling_code_with_number`;
  if (boardField?.type === 'Country') return `${fieldId}.country_code`;
  return fieldId;
};

export function splitOriginTypeString(input: string): {
  sourceCategory: string;
  sourceType: string;
} {
  const [sourceCategory, ...rest] = input.split('_');
  const sourceType = rest.join('_');
  return { sourceCategory, sourceType };
}

export const validateFilterValue = (
  inputData: Record<
    string,
    string | string[] | number | boolean | null | undefined
  >
): string | string[] | number | boolean => {
  let { value: fieldValue } = inputData;
  if (typeof fieldValue === 'string') fieldValue = fieldValue.trim();
  if (fieldValue === '' || fieldValue === undefined || fieldValue === null) {
    throw Error(
      `Please confirm that the values in the parameters are filled in and valid`
    );
  }
  return fieldValue;
};

export async function checkAndFormatFieldValue(
  inputData: Record<
    string,
    string | string[] | number | boolean | null | undefined
  >,
  allowError: boolean,
  additionalData: { board: IBoard; organization_id: string }
): Promise<any> {
  let { field: fieldId, value: fieldValue } = inputData;
  const { board, organization_id } = additionalData;

  const boardField = getBoardFieldById(board, fieldId as string);
  if (!boardField || Object.keys(boardField).length === 0 || !boardField.type) {
    throw Error(`Field not found for value: ${fieldValue as string}`);
  }

  // remove whitespace
  if (typeof fieldValue === 'string') fieldValue = fieldValue.trim();

  if (fieldValue === '' || fieldValue === undefined) {
    if (allowError) return null;
    throw Error('Value is required.');
  }

  if (Array.isArray(fieldValue) && fieldValue.length === 0) {
    if (allowError) return null;
    throw Error('Value is required.');
  }

  if (
    fieldValue === null ||
    (typeof fieldValue === 'object' &&
      !Array.isArray(fieldValue) &&
      Object.keys(fieldValue).length === 0)
  ) {
    if (allowError) return null;
    throw Error('Value is required.');
  }

  switch (boardField.type) {
    case 'Date':
    case 'Datetime':
      return isDate(fieldValue) ? convertDateToISOString(fieldValue) : null;
    case 'Time':
      return isDate(fieldValue) ? fieldValue : null;
    case 'Number':
      return isNumber(fieldValue) ? convertToNumber(fieldValue) : null;
    case 'MultipleSelection':
    case 'MultipleAssignee':
      if (Array.isArray(fieldValue)) return fieldValue;
      return handleString(fieldValue as string, allowError)
        .split(',')
        .map((item) => item.trim());
    case 'RichText':
      return fieldValue;
    case 'Phone':
      return formatPhoneNumberWithCountryCallingCode(fieldValue as string);
    case 'Notes':
      return [
        {
          message: fieldValue,
          author_name: 'System Automation',
        },
      ];
    case 'Origin': {
      const { originalSource } = inputData;
      if (!originalSource || typeof originalSource !== 'string') return null;

      const { sourceCategory, sourceType } =
        splitOriginTypeString(originalSource);
      let originalSourceId = fieldValue;
      let originalSourceType = sourceType;
      let originalSourceName = '';

      if (sourceCategory === 'customized') {
        originalSourceType = '';
        if (sourceType === 'other') {
          originalSourceName = fieldValue as string;
          originalSourceId = fieldValue as string;
        } else {
          const selectedOption = boardField.data.find(
            (item) => item._id === fieldValue
          );
          if (!selectedOption) return null;
          originalSourceName = selectedOption.value;
          originalSourceId = selectedOption.value;
        }
      } else if (sourceCategory === 'channel') {
        const response = await httpClient.sendRequest({
          method: HttpMethod.GET,
          url: `${CHANNEL_BASE}/v1/channels/${fieldValue}`,
          headers: { 'x-organization-id': organization_id },
        });
        originalSourceName = (response.body as any)?.name;
      } else if (sourceCategory === 'journey') {
        // No microservice equivalent yet — isolated on LEGACY_APPS_BASE.
        const response = await httpClient.sendRequest({
          method: HttpMethod.GET,
          url: `${LEGACY_APPS_BASE}/v1/organization/${organization_id}/apps/`,
        });
        originalSourceName = (response.body as any)?.data.find(
          (item: any) => item._id === fieldValue
        )?.title;
      }

      return {
        type: sourceCategory,
        data: {
          id: originalSourceId,
          name: originalSourceName,
          type: originalSourceType,
        },
      };
    }
    case 'Checkbox':
      return fieldValue === 'is_checked';
    case 'Attachment': {
      const urls = convertStringToArray(fieldValue as string);
      return urls.map((urlStr) => ({
        type: 'url',
        data: { name: urlStr, url: urlStr },
      }));
    }
    case 'Currency': {
      const { currencyCode } = inputData;
      if (!currencyCode || typeof currencyCode !== 'string') return null;

      let number: number | null = Number(fieldValue);
      if (isNaN(number)) {
        if (allowError) {
          number = null;
        } else {
          throw Error(
            'Please confirm whether the value of the Currency field is a valid number'
          );
        }
      }
      return {
        amounts: number,
        currency_code: currencyCode,
      };
    }
    default: {
      fieldValue = handleString(fieldValue as string, allowError);
      if (
        boardField.type === 'ShortText' &&
        (fieldValue as string).length >= 150
      ) {
        return null;
      }
      return fieldValue;
    }
  }
}

export async function setWorkflowOutputHistory(
	conversation_id: string,
	nodeName: string,
	output_index: string,
): Promise<void> {
	await setRedisHash('setWorkflowOutputHistory', conversation_id, nodeName, output_index);
}

export async function setRedisHash(
	operation: string,
	hash: string,
	key: string,
	value: string,
	expireTime?: number | undefined,
) {
	console.log(`<${operation}> Start setting up Redis: `, { hash, key, value });
	try {
		const result = await redisHSet(hash, key, value);
		if (expireTime) {
			await redisExpire(hash, expireTime);
		}
		console.log(`<${operation}> [${key}] saved to Redis result: `, result);
	} catch (error) {
		console.log(`<${operation}> Error setting Redis data: ${hash}, $${key}, ${value}: `, error);
	}
}
