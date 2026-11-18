import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiRequestError, apiFetchClient, getAccessToken, getApiBaseUrl, refreshAccessToken } from "../client";
import { prepareChecklistPhoto } from "@/lib/utils/mediaUpload";
import type {
  ChangePasswordPayload,
  ChangePasswordResponse,
  ProfilePhotoResponse,
  ProfilePhotoResult,
  UserProfileResponse,
} from "../types";

export const CURRENT_USER_QUERY_KEY = ["current-user"] as const;

export const useCurrentUser = (options: { refetchOnMount?: boolean | "always" } = {}) =>
  useQuery<UserProfileResponse, Error>({
    refetchOnMount: options.refetchOnMount,
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async () => {
      const response = await apiFetchClient.get<UserProfileResponse>("/users/me");

      return response.data;
    },
    staleTime: 60_000,
  });

export const useChangePassword = () =>
  useMutation<ChangePasswordResponse, Error, ChangePasswordPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<ChangePasswordResponse, ChangePasswordPayload>(
        "/users/change-password",
        payload,
      );

      return response.data;
    },
  });

/** A profile photo only needs to show a face: 800px keeps it sharp at ~60-120 KB. */
const PROFILE_PHOTO_MAX_SIDE = 800;
const PROFILE_PHOTO_PATH = "/driver-app/profile-photo";
/** The server checks the photo with AI before saving it, which can take a few seconds. */
const PROFILE_PHOTO_TIMEOUT_MS = 60_000;

const postProfilePhoto = (blob: Blob, token?: string) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const form = new FormData();
    form.append("file", blob, "profile-photo.jpg");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBaseUrl()}${PROFILE_PHOTO_PATH}`);
    xhr.setRequestHeader("Accept", "application/json");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = PROFILE_PHOTO_TIMEOUT_MS;
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () =>
      reject(new ApiRequestError({ code: "ERR_NETWORK", message: "Unable to reach the server. Please check your connection and try again." }));
    xhr.ontimeout = () =>
      reject(new ApiRequestError({ code: "ECONNABORTED", message: "The upload timed out. Please try again." }));
    xhr.send(form);
  });

const parseProfilePhotoBody = (body: string) => {
  try {
    return JSON.parse(body) as ProfilePhotoResponse;
  } catch {
    return undefined;
  }
};

/**
 * Compresses and uploads the driver's profile photo. The server checks it
 * (one clear, well-lit face) before saving; a rejected photo fails with the
 * reason, written for the driver.
 */
export const useUploadProfilePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation<ProfilePhotoResult, Error, { file: Blob }>({
    mutationFn: async ({ file }) => {
      const blob = await prepareChecklistPhoto(file, PROFILE_PHOTO_MAX_SIDE);

      let response = await postProfilePhoto(blob, getAccessToken());
      if (response.status === 401) {
        const token = await refreshAccessToken();
        if (token) response = await postProfilePhoto(blob, token);
      }

      const body = parseProfilePhotoBody(response.body);
      if (response.status < 200 || response.status >= 300 || !body?.data?.profilePictureUrl) {
        // A rejected photo comes back as a 400 whose message says what to change.
        throw new ApiRequestError({
          code: "ERR_BAD_RESPONSE",
          data: body as never,
          message: body?.message || `Request failed with status ${response.status}. Please try again.`,
          status: response.status,
        });
      }

      return body.data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<UserProfileResponse>(CURRENT_USER_QUERY_KEY, (current) =>
        current ? { ...current, data: { ...current.data, profilePictureUrl: result.profilePictureUrl } } : current,
      );
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });
};
