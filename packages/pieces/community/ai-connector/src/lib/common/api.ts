// pieces/common/imbrace-api.ts
import { httpClient, HttpMethod, HttpRequest } from '@activepieces/pieces-common';

function buildOptions(
  method: HttpMethod,
  baseUri: string,
  endpoint: string,
  body?: any
): HttpRequest<any> {
  const url = `${baseUri}${endpoint}`;
  const options: HttpRequest<any> = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  };

  if (!body || (typeof body === 'object' && !Object.keys(body).length)) {
    delete options.body;
  }

  return options;
}

export async function imbraceApiRequest(
  method: HttpMethod,
  endpoint: string,
  body: any = {},
  oldApi = false,
  accessToken?: string,
  extraHeaders?: Record<string, string>
): Promise<any> {
  try {
    // const { NODE_ENV: env, TEMPORARY_TOKEN: temp_token } = process.env;

    // const x_access_token =
    //   env === 'production'
    //     ? accessToken // ideally injected via PieceAuth
    //     : temp_token;
    console.log('Using access token:', accessToken);
    let baseUri = process.env['IMBRACE_API_DOMAIN'] || 'https://app-gateway.dev.imbrace.co';
    if (oldApi) {
      baseUri = process.env['IMBRACE_API_OLD_DOMAIN'] || 'https://dev-app-api.imbrace.co';
    }

    const options = buildOptions(method, baseUri, endpoint, body);
    options.headers!['X-Access-Token'] = accessToken || '';
    if (accessToken) {
      options.headers!['Authorization'] = `Bearer ${accessToken}`;
    }
    if (extraHeaders) {
      Object.assign(options.headers!, extraHeaders);
    }

    const response = await httpClient.sendRequest(options);
    return response.body ?? response;
  } catch (error: any) {
    throw new Error(
      `imbraceApiRequest failed: ${error.message || JSON.stringify(error)}`
    );
  }
}

export async function imbraceApiRequestPrivateService(
  method: HttpMethod,
  endpoint: string,
  body: any = {}
): Promise<any> {
  try {
    // Legacy backend retired — route through the app-gateway. (Unused helper.)
    const baseUri =
      process.env['IMBRACE_API_DOMAIN'] || 'https://app-gateway.dev.imbrace.co';

    const options = buildOptions(method, baseUri, endpoint, body);
    const response = await httpClient.sendRequest(options);
    return response.body ?? response;
  } catch (error: any) {
    throw new Error(
      `imbraceApiRequestPrivateService failed: ${error.message || JSON.stringify(error)}`
    );
  }
}

export const publicImbraceApiDomain =
  process.env['IMBRACE_API_DOMAIN'] || '';
