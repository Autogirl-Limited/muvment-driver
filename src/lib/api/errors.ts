import type { ApiErrorResponse } from "./types";

type ApiErrorLike = {
  code?: string;
  data?: ApiErrorResponse;
  response?: {
    data?: ApiErrorResponse;
    status: number;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => {
  if (!isRecord(value)) {
    return false;
  }

  return "message" in value || "status" in value || "timestamp" in value;
};

const getApiErrorLike = (error: unknown): ApiErrorLike | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }

  const topLevelStatus = typeof error.status === "number" ? error.status : undefined;

  const hasApiShape =
    typeof error.code === "string" ||
    isApiErrorResponse(error.data) ||
    typeof topLevelStatus === "number" ||
    (isRecord(error.response) && typeof error.response.status === "number");

  if (!hasApiShape) {
    return undefined;
  }

  const response =
    isRecord(error.response) && typeof error.response.status === "number"
      ? {
          data: isApiErrorResponse(error.response.data) ? error.response.data : undefined,
          status: error.response.status,
        }
      : topLevelStatus !== undefined
        ? {
            data: isApiErrorResponse(error.data) ? error.data : undefined,
            status: topLevelStatus,
          }
        : undefined;

  return {
    code: typeof error.code === "string" ? error.code : undefined,
    data: isApiErrorResponse(error.data) ? error.data : undefined,
    response,
  };
};

const getMessageFromPayload = (payload?: ApiErrorResponse) => {
  const apiMessage = payload?.message;

  if (Array.isArray(apiMessage)) {
    return apiMessage.join("\n");
  }

  return apiMessage;
};

export const getApiErrorMessage = (error: unknown) => {
  const apiError = getApiErrorLike(error);

  if (apiError) {
    const apiMessage =
      getMessageFromPayload(apiError.response?.data) ?? getMessageFromPayload(apiError.data);

    if (apiMessage) {
      return apiMessage;
    }

    if (apiError.code === "ECONNABORTED") {
      return "The request timed out. Please check your connection and try again.";
    }

    if (apiError.code === "ERR_NETWORK" || !apiError.response) {
      return "Unable to reach the server. Please check your connection and try again.";
    }

    return `Request failed with status ${apiError.response.status}. Please try again.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
};

export const getApiErrorStatus = (error: unknown) => getApiErrorLike(error)?.response?.status;

// The checklist "step already submitted for this tracker" conflict returns
// 403 on this backend, not the standard 409. Checklist step screens use this
// to trigger conflict-recovery instead of surfacing the raw error.
export const isChecklistStepConflictError = (error: unknown) => {
  const status = getApiErrorStatus(error);

  return status === 403 || status === 409;
};
