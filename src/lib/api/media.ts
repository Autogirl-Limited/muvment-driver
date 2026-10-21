import { apiFetchClient } from "./client";
import type {
  CreatePresignedMediaUrlPayload,
  CreatePresignedMediaUrlResponse,
  DeleteMediaPayload,
  DeleteMediaResponse,
} from "./types";

export const MEDIA_PATH = "/media";
export const MEDIA_PRESIGNED_URL_PATH = "/media/presigned-url";

export const createPresignedMediaUrl = async (
  payload: CreatePresignedMediaUrlPayload,
): Promise<CreatePresignedMediaUrlResponse> => {
  const response = await apiFetchClient.post<
    CreatePresignedMediaUrlResponse,
    CreatePresignedMediaUrlPayload
  >(MEDIA_PRESIGNED_URL_PATH, payload);

  return response.data;
};

export const deleteMedia = async (payload: DeleteMediaPayload): Promise<DeleteMediaResponse> =>
  apiFetchClient.request<DeleteMediaResponse, DeleteMediaPayload>(MEDIA_PATH, {
    body: payload,
    method: "DELETE",
  });
