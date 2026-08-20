import axios, { AxiosRequestConfig } from 'axios';
import qs from 'qs';

import { dashboardAutoLogin } from '@/lib/dashboard-auto-login';
import { runtimeConfigService } from '@/lib/runtime-config';

const DEFAULT_GATEWAY_URL = 'https://app-gateway.dev.imbrace.co';

function getGatewayUrl(): string {
  const config = runtimeConfigService.getCurrentConfig();
  return config?.AP_GATEWAY_URL || DEFAULT_GATEWAY_URL;
}

function getGatewayHeaders() {
  const headers: Record<string, string> = {};

  const accessToken = dashboardAutoLogin.getAccessToken();
  const organizationId = dashboardAutoLogin.getOrganizationId();
  const userId = dashboardAutoLogin.getUserId();

  if (accessToken) {
    headers['X-Access-Token'] = accessToken;
  }

  if (organizationId) {
    headers['x-organization-id'] = organizationId;
  }

  if (userId) {
    headers['X-User-Id'] = userId;
  }

  return headers;
}

function request<TResponse>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<TResponse> {
  const resolvedUrl = `${getGatewayUrl()}${url}`;

  return axios({
    url: resolvedUrl,
    ...config,
    headers: {
      ...config.headers,
      ...getGatewayHeaders(),
    },
  }).then((response) => response.data as TResponse);
}

export const gatewayApi = {
  get: <TResponse>(
    url: string,
    query?: unknown,
    config?: AxiosRequestConfig,
  ) =>
    request<TResponse>(url, {
      params: query,
      paramsSerializer: (params) => {
        return qs.stringify(params, {
          arrayFormat: 'repeat',
        });
      },
      ...config,
    }),
  post: <TResponse, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig,
  ) =>
    request<TResponse>(url, {
      method: 'POST',
      data: body,
      headers: { 'Content-Type': 'application/json' },
      ...config,
    }),
};
