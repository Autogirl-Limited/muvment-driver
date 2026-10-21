import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetchClient } from "../client";
import type { ChangePasswordPayload, ChangePasswordResponse, UserProfileResponse } from "../types";

export const CURRENT_USER_QUERY_KEY = ["current-user"] as const;

export const useCurrentUser = () =>
  useQuery<UserProfileResponse, Error>({
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
