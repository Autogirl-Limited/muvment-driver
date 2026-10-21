import type { ApiErrorResponse } from "./types";
import { isAppKnownOffline, OFFLINE_ERROR_CODE, OFFLINE_ERROR_MESSAGE } from "../utils/networkStatus";

export const AUTH_LOGIN_PATH = "/auth/login";
export const AUTH_REFRESH_PATH = "/auth/refresh-token";
export const AUTH_VERIFY_ACCOUNT_PATH = "/auth/verify-account";
export const AUTH_RESEND_VERIFICATION_OTP_PATH = "/auth/resend-verification-otp";
export const AUTH_FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const AUTH_RESET_PASSWORD_PATH = "/auth/reset-password";
export const DRIVER_APPLICATIONS_PATH = "/driver-applications";

const AUTH_EXEMPT_PATHS = [
  AUTH_LOGIN_PATH,
  AUTH_REFRESH_PATH,
  AUTH_VERIFY_ACCOUNT_PATH,
  AUTH_RESEND_VERIFICATION_OTP_PATH,
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_RESET_PASSWORD_PATH,
  DRIVER_APPLICATIONS_PATH,
] as const;
const REFRESH_EXEMPT_PATHS = [AUTH_LOGIN_PATH, AUTH_REFRESH_PATH] as const;

const IS_DEV = process.env.NODE_ENV === "development";

export const isApiBaseUrlConfigured = () => Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());

export const getApiBaseUrl = (): string => {
  const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!rawApiBaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_URL. Add it to .env.local and restart the dev server.",
    );
  }

  return rawApiBaseUrl.replace(/\/+$/, "");
};

/* ------------------------------------------------------------------ session bridge
   NextAuth owns the tokens (in the encrypted session cookie). The client
   component <SessionTokenSync/> pushes the current access token in here and
   registers a refresh handler, so this plain module can attach the bearer
   header synchronously and recover from a 401 without React.
--------------------------------------------------------------------------- */
type RefreshHandler = () => Promise<string | undefined>;
type UnauthorizedHandler = () => void;

let currentAccessToken: string | undefined;
let refreshHandler: RefreshHandler | undefined;
let unauthorizedHandler: UnauthorizedHandler | undefined;
let inFlightRefresh: Promise<string | undefined> | undefined;

export const setAccessToken = (token?: string) => {
  currentAccessToken = token;
};

export const getAccessToken = () => currentAccessToken;

export const setRefreshHandler = (handler?: RefreshHandler) => {
  refreshHandler = handler;
};

export const setUnauthorizedHandler = (handler?: UnauthorizedHandler) => {
  unauthorizedHandler = handler;
};

const refreshAccessToken = async () => {
  if (!refreshHandler) {
    return undefined;
  }

  if (!inFlightRefresh) {
    inFlightRefresh = refreshHandler()
      .then((token) => {
        if (token) {
          currentAccessToken = token;
        }

        return token;
      })
      .catch(() => undefined)
      .finally(() => {
        inFlightRefresh = undefined;
      });
  }

  return inFlightRefresh;
};

/* ------------------------------------------------------------------ request */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiHeaders = Record<string, string>;

type ApiRequestOptions<TBody = unknown> = {
  acceptedStatuses?: readonly number[];
  auth?: boolean;
  body?: TBody;
  headers?: ApiHeaders;
  method: HttpMethod;
  retryOnUnauthorized?: boolean;
  silent?: boolean;
};

type ApiClientResponse<TResponse> = {
  data: TResponse;
};

type ApiFailurePayload = ApiErrorResponse | undefined;

export class ApiRequestError extends Error {
  code?: string;
  data?: ApiFailurePayload;
  response?: {
    data?: ApiFailurePayload;
    status: number;
  };
  status?: number;

  constructor({
    code,
    data,
    message,
    status,
  }: {
    code?: string;
    data?: ApiFailurePayload;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.data = data;
    this.status = status;

    if (status) {
      this.response = { data, status };
    }
  }
}

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const getRequestPath = (url?: string) => {
  if (!url) {
    return "";
  }

  try {
    if (isAbsoluteUrl(url)) {
      return new URL(url).pathname;
    }
  } catch {
    return url;
  }

  return `/${url.replace(/^\/+/, "").split(/[?#]/)[0]}`;
};

const getRequestUrl = (path: string) => {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  return `${getApiBaseUrl()}/${path.replace(/^\/+/, "")}`;
};

const matchesPath = (url: string | undefined, paths: readonly string[]) => {
  const requestPath = getRequestPath(url);

  return paths.some((path) => requestPath.endsWith(path));
};

const shouldSkipAuth = (url?: string) => !url || matchesPath(url, AUTH_EXEMPT_PATHS);

const shouldSkipRefresh = (url?: string) => !url || matchesPath(url, REFRESH_EXEMPT_PATHS);

const getApiErrorMessage = (data: ApiFailurePayload, fallback: string) => {
  const message = data?.message;

  if (Array.isArray(message)) {
    return message.join("\n");
  }

  return message || fallback;
};

const parseResponseBody = async (response: Response) => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return undefined;
  }
};

const log = (level: "log" | "warn", event: string, details: Record<string, unknown>) => {
  if (IS_DEV) {
    console[level](`[api:fetch] ${event}`, details);
  }
};

const fetchRequest = async (url: string, init: RequestInit) => {
  if (isAppKnownOffline()) {
    throw new ApiRequestError({ code: OFFLINE_ERROR_CODE, message: OFFLINE_ERROR_MESSAGE });
  }

  try {
    return await fetch(url, init);
  } catch (error) {
    throw new ApiRequestError({
      code: "ERR_NETWORK",
      message:
        error instanceof Error && error.name !== "TypeError"
          ? error.message
          : "Unable to reach the server. Please check your connection and try again.",
    });
  }
};

const request = async <TResponse, TBody = unknown>(
  path: string,
  {
    acceptedStatuses,
    auth = true,
    body,
    headers,
    method,
    retryOnUnauthorized = true,
    silent = false,
  }: ApiRequestOptions<TBody>,
): Promise<TResponse> => {
  const url = getRequestUrl(path);
  const requestHeaders: ApiHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...headers,
  };
  const shouldAttachAuth = auth && !shouldSkipAuth(path);

  if (shouldAttachAuth && currentAccessToken) {
    requestHeaders.Authorization = `Bearer ${currentAccessToken}`;
  }

  if (!silent) {
    log("log", "request", { method, url });
  }

  try {
    const response = await fetchRequest(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: requestHeaders,
      method,
      cache: "no-store",
    });
    const responseBody = await parseResponseBody(response);

    if (!silent) {
      log("log", "response", { method, status: response.status, url });
    }

    if (response.status === 401 && retryOnUnauthorized && !shouldSkipRefresh(path)) {
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        return request<TResponse, TBody>(path, {
          acceptedStatuses,
          auth,
          body,
          headers,
          method,
          retryOnUnauthorized: false,
          silent,
        });
      }

      if (shouldAttachAuth) {
        unauthorizedHandler?.();
      }
    }

    if (!response.ok && !acceptedStatuses?.includes(response.status)) {
      const errorData = responseBody as ApiFailurePayload;

      throw new ApiRequestError({
        data: errorData,
        message: getApiErrorMessage(
          errorData,
          `Request failed with status ${response.status}. Please try again.`,
        ),
        status: response.status,
      });
    }

    return responseBody as TResponse;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (!silent) {
        log("warn", "failure", { code: error.code, message: error.message, method, status: error.status, url });
      }
      throw error;
    }

    const requestError = new ApiRequestError({
      code: "ERR_UNKNOWN",
      message:
        error instanceof Error ? error.message : "Unable to complete the request. Please try again.",
    });

    if (!silent) {
      log("warn", "failure", { message: requestError.message, method, url });
    }
    throw requestError;
  }
};

export const apiFetchClient = {
  delete: async <TResponse>(path: string, headers?: ApiHeaders): Promise<ApiClientResponse<TResponse>> => ({
    data: await request<TResponse>(path, { headers, method: "DELETE" }),
  }),
  get: async <TResponse>(path: string, headers?: ApiHeaders): Promise<ApiClientResponse<TResponse>> => ({
    data: await request<TResponse>(path, { headers, method: "GET" }),
  }),
  patch: async <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    headers?: ApiHeaders,
  ): Promise<ApiClientResponse<TResponse>> => ({
    data: await request<TResponse, TBody>(path, { body, headers, method: "PATCH" }),
  }),
  post: async <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    headers?: ApiHeaders,
  ): Promise<ApiClientResponse<TResponse>> => ({
    data: await request<TResponse, TBody>(path, { body, headers, method: "POST" }),
  }),
  put: async <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    headers?: ApiHeaders,
  ): Promise<ApiClientResponse<TResponse>> => ({
    data: await request<TResponse, TBody>(path, { body, headers, method: "PUT" }),
  }),
  request,
};
