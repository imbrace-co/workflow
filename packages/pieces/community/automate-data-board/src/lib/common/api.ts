import { countries } from '../../constants/contryData';
import { hiddenFieldTypes } from './constants';
import type { IBoard, IBoardField } from './types';
import {
  httpClient,
  HttpMethod,
  HttpRequest,
} from '@activepieces/pieces-common';
type AuthLike = any;
export type JsonObject = Record<string, any>;
// Data-board microservice (direct host). Metadata reads use bare /v1/board/:id,
// items/search use /api/boards/... (legacy backend retired).
const baseUri = process.env['IMBRACE_DATABOARD_API'] || process.env['IMBRACE_PRIVATE_API'] || 'https://webapp.dev.imbrace.co/api/data-board';
// Channel-service (direct host) for /v1/channels/:id lookups.
export const CHANNEL_BASE = (
  process.env['IMBRACE_CHANNEL_API'] || 'http://channel.dev.imbrace.lan'
).replace(/\/$/, '');
// LEGACY monolith — only for /v1/organization/:org/apps/ (no microservice yet).
export const LEGACY_APPS_BASE = (
  process.env['IMBRACE_LEGACY_APPS_API'] || process.env['IMBRACE_PRIVATE_API'] || ''
).replace(/\/$/, '');

function getOptions(
  method: HttpMethod,
  baseUrl: string,
  endpoint: string,
  body?: any,
): HttpRequest {
  const request: HttpRequest = {
    method,
    url: `${baseUrl}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  };
  if (!body || (typeof body === 'object' && !Object.keys(body).length)) {
    delete request.body;
  }
  return request;
}

export function getSortedOptions(
  data: JsonObject[],
  nameKey: string,
  valueKey: string | ((item: JsonObject) => string),
  descriptionKey?: string
): { label: string; value: string; description?: string }[] {
  return data
    .map((item) => {
      const option: { label: string; value: string; description?: string } = {
        label: item[nameKey] as string,
        value:
          typeof valueKey === 'function'
            ? valueKey(item)
            : (item[valueKey] as string),
      };

      if (descriptionKey && item[descriptionKey]) {
        option.description = item[descriptionKey] as string;
      }
      return option;
    })
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
}

export async function imbraceApiRequestPrivateService(
  method: HttpMethod,
  endpoint: string,
  body: any = {},
  headers: Record<string, string> = {}
): Promise<any> {
  try {
    const baseUrl = process.env['IMBRACE_DATABOARD_API'] || process.env['IMBRACE_PRIVATE_API'] || 'https://webapp.dev.imbrace.co/api/data-board';
    const request = getOptions(method, baseUrl, endpoint, body);
    request.headers = { ...request.headers, ...headers };
    const response = await httpClient.sendRequest(request);
    // console.log('resp', response);
    
    return response.body;
  } catch (error: any) {
    throw new Error(
      `Private Imbrace API request failed: ${error.message ?? error}`
    );
  }
}

export async function imbraceApiRequest(
  method: HttpMethod,
  endpoint: string,
  body: any = {},
  oldApi = false,
  accessToken?: string,
  headers: Record<string, string> = {}
): Promise<any> {
  try {
    console.log('Using access token:', accessToken);
    let baseUri = process.env['IMBRACE_API_DOMAIN'] || 'https://app-gateway.dev.imbrace.co';
    if (oldApi) {
      baseUri = process.env['IMBRACE_API_OLD_DOMAIN'] || 'https://dev-app-api.imbrace.co';
    }

    const options = getOptions(method, baseUri, endpoint, body);
    options.headers = { ...options.headers, 'X-Access-Token': accessToken || '', ...headers };
    if (accessToken) {
      options.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await httpClient.sendRequest(options);
    return response.body ?? response;
  } catch (error: any) {
    throw new Error(
      `imbraceApiRequest failed: ${error.message || JSON.stringify(error)}`
    );
  }
}

export const callImbracePrivateApi = async (
  method: HttpMethod,
  endpoint: string,
  body?: any
) => imbraceApiRequestPrivateService(method, endpoint, body);

/**
 * Get Data Board List
 */
export async function fetchBoardList(auth: AuthLike, organizationId?: string) {
  // GET /data-board/boards
  try {
    const boardData = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUri}/api/boards`,
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': organizationId || 'org_imbrace',
      },
    });
    console.log('board', boardData);
    const list = (boardData.body as any)?.data ?? [];
    return list.map((b: any) => ({
      label: b.name,
      value: b._id,
      description: b.description,
    }));
  } catch (err) {
    console.error('fetchBoardList error', err);
    return [];
  }
}

export async function fetchBoard(
  auth: AuthLike,
  boardId: string
): Promise<IBoard> {
  const method = HttpMethod.GET;

  const board = await imbraceApiRequestPrivateService?.(
    method,
    `/v1/board/${boardId}`
  );
  return board as IBoard;
}

export async function getBoardFieldForIdentifier(
  boardId: string
): Promise<{ label: string; value: string; description?: string }[]> {
  // const baseUri = process.env['IMBRACE_PRIVATE_API'];
  if (!baseUri) throw new Error('IMBRACE_PRIVATE_API not set');

  const boardRes = await httpClient.sendRequest({
    method: HttpMethod.GET,
    url: `${baseUri}/v1/board/${boardId}`,
  });

  const board = boardRes.body;
  if (!board?.fields) return [];

  const filteredFields = (board.fields as IBoardField[]).filter(
    (field) => !hiddenFieldTypes.identifier.includes(field.type)
  );

  return getSortedOptions(filteredFields, 'name', '_id', 'description');
}

export async function getBoardDetailsApi(boardId: string) {
  const method = HttpMethod.GET;
  const endpoint = `/v1/board/${boardId}`;
  const board = await imbraceApiRequestPrivateService?.(
    method,
    endpoint
  );

  console.log('boardDetail', board);
  
  return board as IBoard;
}

export async function getBoardField(
  boardId: string,
  action: string
): Promise<{ label: string; value: string; description?: string }[]> {
  // const baseUri = process.env['IMBRACE_PRIVATE_API'];
  if (!baseUri) throw new Error('IMBRACE_PRIVATE_API not set');

  const boardRes = await httpClient.sendRequest({
    method: HttpMethod.GET,
    url: `${baseUri}/v1/board/${boardId}`,
  });

  const board = boardRes.body;
  if (!board?.fields) return [];

  const filteredFields = (board.fields as IBoardField[]).filter((field) => {
    if (action === 'create') {
      return true;
    } else {
      return !hiddenFieldTypes.otherAction.includes(field.type);
    }
  });

  return getSortedOptions(filteredFields, 'name', '_id', 'description');
}

export async function getCurrencies() {
  const codes = countries.reduce<string[]>((acc, c) => {
    if (c.currencies) acc.push(...Object.keys(c.currencies));
    return acc;
  }, []);
  const unique = [...new Set(codes)].sort();
  return unique.map((code) => ({ label: code, value: code }));
}
