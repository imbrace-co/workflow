import { ApErrorParams, ErrorCode, isNil } from '@activepieces/shared';
import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  HttpStatusCode,
  isAxiosError,
} from 'axios';
import qs from 'qs';

import { authenticationSession } from '@/lib/authentication-session';
// Import dashboard-auto-login early to trigger URL parameter processing
import { dashboardAutoLogin } from '@/lib/dashboard-auto-login';

export const API_BASE_URL =
  import.meta.env.MODE === 'cloud'
    ? 'https://cloud.activepieces.com'
    : import.meta.env.VITE_GATEWAY_URL || window.location.origin;

console.log('API: Using base URL:', API_BASE_URL);
export const API_URL = `${API_BASE_URL}/api`;

const disallowedRoutes = [
  '/v1/managed-authn/external-token',
  '/v1/authentication/sign-in',
  '/v1/authentication/sign-up',
  '/v1/authn/local/verify-email',
  '/v1/authn/federated/login',
  '/v1/authn/federated/claim',
  '/v1/otp',
  '/v1/human-input',
  '/v1/authn/local/reset-password',
  '/v1/user-invitations/accept',
  '/v1/webhooks',
];
//This is important to avoid redirecting to sign-in page when the user is deleted for embedding scenarios
const ignroedGlobalErrorHandlerRoutes = ['/v1/users/me'];
function isUrlRelative(url: string) {
  return !url.startsWith('http') && !url.startsWith('https');
}

function globalErrorHandler(error: AxiosError) {
  if (api.isError(error)) {
    const errorCode: ErrorCode | undefined = (
      error.response?.data as { code: ErrorCode }
    )?.code;

    console.log('API: Global error handler triggered', {
      status: error.response?.status,
      errorCode,
      statusText: error.response?.statusText,
    });

    const hasExternalAuth = Boolean(
      dashboardAutoLogin.getAccessToken() &&
        dashboardAutoLogin.getOrganizationId(),
    );

    if (
      errorCode === ErrorCode.SESSION_EXPIRED ||
      errorCode === ErrorCode.INVALID_BEARER_TOKEN ||
      error.response?.status === 401
    ) {
      // In external (gateway) auth mode, do not clear tokens or force redirect.
      // Let the caller surface the error, since the gateway is the source of truth.
      if (hasExternalAuth) {
        console.warn(
          'API: 401 under external auth, suppressing global sign-out',
        );
        return;
      }

      // JWT mode: clear tokens and redirect to sign-in
      authenticationSession.logOut();
      dashboardAutoLogin.clearAccessTokenInfo();
      console.log(
        'API: Authentication failed (JWT), clearing tokens and redirecting',
      );
      window.location.href = '/sign-in';
    }
  }
}

function request<TResponse>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<TResponse> {
  const resolvedUrl = !isUrlRelative(url) ? url : `${API_URL}${url}`;
  const isApWebsite = resolvedUrl.startsWith(API_URL);
  const unAuthenticated = disallowedRoutes.some((route) =>
    resolvedUrl.replace(API_URL, '').startsWith(route),
  );

  // console.log('API: Making request to', resolvedUrl);

  return axios({
    url: resolvedUrl,
    ...config,
    headers: {
      ...config.headers,
      Authorization: getToken(
        unAuthenticated,
        isApWebsite,
        authenticationSession.getToken(),
      ),
      ...getExternalHeaders(unAuthenticated, isApWebsite),
    },
  })
    .then((response) =>
      config.responseType === 'blob'
        ? response.data
        : (response.data as TResponse),
    )
    .catch((error) => {
      if (
        isAxiosError(error) &&
        !ignroedGlobalErrorHandlerRoutes.includes(url)
      ) {
        globalErrorHandler(error);
      }
      throw error;
    });
}

function getToken(
  unAuthenticated: boolean,
  isApWebsite: boolean,
  token: string | null,
) {
  if (unAuthenticated || !isApWebsite) {
    return undefined;
  }
  if (isNil(token)) {
    return undefined;
  }
  return `Bearer ${token}`;
}

function getExternalHeaders(unAuthenticated: boolean, isApWebsite: boolean) {
  if (unAuthenticated || !isApWebsite) {
    console.log(
      'API: Skipping external headers (unAuthenticated or external site)',
    );
    return {};
  }

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

export type HttpError = AxiosError<unknown, AxiosResponse<unknown>>;

export const api = {
  isApError(error: unknown, errorCode: ErrorCode): error is HttpError {
    if (!isAxiosError(error)) {
      return false;
    }
    const responseData = error.response?.data as ApErrorParams;
    return responseData.code === errorCode;
  },
  isError(error: unknown): error is HttpError {
    return isAxiosError(error);
  },
  any: <TResponse>(url: string, config?: AxiosRequestConfig) =>
    request<TResponse>(url, config),
  get: <TResponse>(url: string, query?: unknown, config?: AxiosRequestConfig) =>
    request<TResponse>(url, {
      params: query,
      paramsSerializer: (params) => {
        return qs.stringify(params, {
          arrayFormat: 'repeat',
        });
      },
      ...config,
    }),
  delete: <TResponse>(
    url: string,
    query?: Record<string, string>,
    body?: unknown,
  ) =>
    request<TResponse>(url, {
      method: 'DELETE',
      params: query,
      data: body,
      paramsSerializer: (params) => {
        return qs.stringify(params, {
          arrayFormat: 'repeat',
        });
      },
    }),
  post: <TResponse, TBody = unknown, TParams = unknown>(
    url: string,
    body?: TBody,
    params?: TParams,
    headers?: Record<string, string>,
  ) =>
    request<TResponse>(url, {
      method: 'POST',
      data: body,
      headers: { 'Content-Type': 'application/json', ...headers },
      params: params,
    }),

  patch: <TResponse, TBody = unknown, TParams = unknown>(
    url: string,
    body?: TBody,
    params?: TParams,
  ) =>
    request<TResponse>(url, {
      method: 'PATCH',
      data: body,
      headers: { 'Content-Type': 'application/json' },
      params: params,
    }),
  httpStatus: HttpStatusCode,
};
