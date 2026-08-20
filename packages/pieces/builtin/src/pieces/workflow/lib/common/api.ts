import { httpClient, HttpMethod, HttpRequest } from '@activepieces/pieces-common';

const APWF_BASE_URL_ENV = 'APWF_API_URL';
const GATEWAY_URL_ENV = 'GATEWAY_URL';

function getBaseUrl(): string {
  const apwfUrl = process.env[APWF_BASE_URL_ENV];
  const gatewayUrl = process.env[GATEWAY_URL_ENV];
  if (!apwfUrl || !gatewayUrl) {
    throw new Error(
      `Environment variable ${APWF_BASE_URL_ENV} and ${GATEWAY_URL_ENV} must be set. Configure the APWF backend URL and gateway proxy.`
    );
  }
  const apwfPath = new URL(apwfUrl).pathname.replace(/\/$/, '');
  return gatewayUrl.replace(/\/$/, '') + apwfPath;
}

function filterUndefined(
  params?: Record<string, string | undefined>
): Record<string, string> | undefined {
  if (!params) return undefined;
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      filtered[key] = value;
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

type ApwfApiParams = {
  method: HttpMethod;
  path: string;
  organizationId: string;
  queryParams?: Record<string, string | undefined>;
  body?: unknown;
  accessToken?: string;
};

export async function apwfApiRequest(params: ApwfApiParams): Promise<any> {
  const { method, path, organizationId, queryParams, body, accessToken } = params;
  const baseUrl = getBaseUrl();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-organization-id': organizationId,
  };
  if (accessToken) {
    headers['X-Access-Token'] = accessToken;
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const request: HttpRequest<unknown> = {
    method,
    url: `${baseUrl}${path}`,
    headers,
    queryParams: filterUndefined(queryParams),
    body,
  };

  if (
    !body ||
    (typeof body === 'object' && !Object.keys(body as object).length)
  ) {
    delete request.body;
  }

  const response = await httpClient.sendRequest(request);
  return response.body ?? response;
}

export type ApwfActionResponse = {
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
  nextSteps: string[]
): ApwfActionResponse {
  return { action, success: true, data, summary, nextSteps };
}

export function buildErrorResponse(
  action: string,
  error: unknown
): ApwfActionResponse {
  const message =
    error instanceof Error ? error.message : JSON.stringify(error);
  return {
    action,
    success: false,
    data: null,
    summary: `Error: ${message}`,
    nextSteps: [
      'Check the error message and verify your parameters',
      `Ensure the APWF backend is reachable (env: ${APWF_BASE_URL_ENV})`,
    ],
  };
}
