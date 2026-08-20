import {
  httpClient,
  HttpMethod,
  QueryParams,
} from '@activepieces/pieces-common';

export interface ApiCtx {
  xAccessToken?: string | null;
}

export const envs = {
  IMBRACE_PRIVATE_API: process.env['IMBRACE_PRIVATE_API'] ?? '', // e.g. https://app-gateway.dev.imbrace.co
  IMBRACE_API_DOMAIN: process.env['IMBRACE_API_DOMAIN'] ?? '', // optional override
  IMBRACE_API_OLD_DOMAIN: process.env['IMBRACE_API_OLD_DOMAIN'] ?? '', // optional old API,
  IMBRACE_PRIVATE_API_OLD: process.env['IMBRACE_PRIVATE_API_OLD'] ?? '', // e.g. https://api.demo.imbrace.co:9981
  TEMPORARY_TOKEN: process.env['TEMPORARY_TOKEN'] ?? '', // dev helper
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  IMBRACE_DEMO_API_OLD_DOMAIN: process.env['IMBRACE_DEMO_API_OLD_DOMAIN'] ?? '', // optional old demo API
  IMBRACE_DEMO_API_DOMAIN: process.env['IMBRACE_DEMO_API_DOMAIN'] ?? '', // optional demo API override
  DOCUMENT_API_VERSION: process.env['DOCUMENT_API_VERSION'] ?? 'v2', // API version
};

function baseDomain(oldApi: boolean, isDocumentAI?: boolean): string {
  if (envs.DOCUMENT_API_VERSION === 'v1' && isDocumentAI) {
    if (oldApi)
      return (
        envs.IMBRACE_DEMO_API_OLD_DOMAIN || 'https://api.demo.imbrace.co:9981'
      );
    return envs.IMBRACE_DEMO_API_DOMAIN || 'https://app-gateway.demo.imbrace.co';
  } else {
    // Legacy backend retired — route through the app-gateway in both branches.
    if (oldApi)
      return envs.IMBRACE_API_DOMAIN || 'https://app-gateway.dev.imbrace.co';
    return envs.IMBRACE_API_DOMAIN || 'https://app-gateway.dev.imbrace.co';
  }
}

export async function imbraceApiRequest<T = any>(
  method: HttpMethod,
  endpoint: string,
  body?: unknown,
  oldApi = false,
  accessToken?: string,
  query?: QueryParams,
  isDocumentAI?: boolean,
  timeout?: number
): Promise<T> {
  const uri = `${baseDomain(oldApi, isDocumentAI)}${endpoint}`;
  console.log('Imbrace API Request URL:', uri);
  const token =
    accessToken ??
    (envs.NODE_ENV === 'production' ? null : envs.TEMPORARY_TOKEN) ??
    null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['X-Access-Token'] = token;
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await httpClient.sendRequest<T>({
    method,
    url: uri,
    headers,
    body,
    queryParams: query,
    // Forward the per-request timeout (ms). Without it the shared axios client
    // falls back to its hard-coded 300s default, which silently aborts long
    // Document AI jobs and surfaces as a bodyless HTTP 500.
    timeout,
  });
  return res.body;
}

export type Option = { name: string; value: string; description?: string };

export function getSortedOptions(
  data: Array<Record<string, any>>,
  nameKey: string,
  valueKey: string | ((item: Record<string, any>) => string),
  descriptionKey?: string
): Option[] {
  return data
    .map((item) => {
      const opt: Option = {
        name: String(item[nameKey] ?? ''),
        value:
          typeof valueKey === 'function'
            ? valueKey(item)
            : String(item[valueKey] ?? ''),
      };
      if (descriptionKey && item[descriptionKey])
        opt.description = String(item[descriptionKey]);
      return opt;
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
}
