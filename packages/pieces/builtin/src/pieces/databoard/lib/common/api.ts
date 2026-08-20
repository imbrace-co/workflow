import {
  httpClient,
  HttpMethod,
  HttpRequest,
} from '@activepieces/pieces-common';

// Data-board microservice (direct internal host). Actions use /api/boards/... paths.
const DEFAULT_DATABOARD_API = 'http://data-board.dev.imbrace.lan';

function getBaseUrl(): string {
  return (
    process.env['IMBRACE_DATABOARD_API'] ||
    process.env['IMBRACE_PRIVATE_API'] ||
    DEFAULT_DATABOARD_API
  ).replace(/\/$/, '');
}

export async function privateApiRequest(
  method: HttpMethod,
  endpoint: string,
  body?: unknown,
  queryParams?: Record<string, string>,
  headers?: Record<string, string>,
): Promise<any> {
  const baseUrl = getBaseUrl();
  const request: HttpRequest = {
    method,
    url: `${baseUrl}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    queryParams,
    body,
  };
  if (!body || (typeof body === 'object' && !Object.keys(body as object).length)) {
    delete request.body;
  }
  const response = await httpClient.sendRequest(request);
  return response.body ?? response;
}

export type ActionResponse = {
  action: string;
  success: boolean;
  data: unknown;
  summary: string;
  nextSteps: string[];
};

export function buildResponse(
  action: string,
  data: unknown,
  summary: string,
  nextSteps: string[] = [],
): ActionResponse {
  return { action, success: true, data, summary, nextSteps };
}

export function buildErrorResponse(
  action: string,
  error: unknown,
): ActionResponse {
  const message =
    error instanceof Error ? error.message : JSON.stringify(error);
  return {
    action,
    success: false,
    data: null,
    summary: `Error: ${message}`,
    nextSteps: [
      'Check the error message and verify your parameters',
      'Ensure the private API is reachable (env: IMBRACE_PRIVATE_API)',
    ],
  };
}
