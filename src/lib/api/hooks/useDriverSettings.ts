import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetchClient } from "../client";
import type { DriverNotificationSettingsResponse } from "../types";

export const DRIVER_NOTIFICATION_SETTINGS_PATH = "/driver-app/settings/notification";

export const DRIVER_NOTIFICATION_SETTINGS_QUERY_KEY = ["driver-notification-settings"] as const;

export const useDriverNotificationSettings = () =>
  useQuery<DriverNotificationSettingsResponse, Error>({
    queryKey: DRIVER_NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiFetchClient.get<DriverNotificationSettingsResponse>(
        DRIVER_NOTIFICATION_SETTINGS_PATH,
      );

      return response.data;
    },
    staleTime: 60_000,
  });

export const useToggleDriverNotificationSettings = () => {
  const queryClient = useQueryClient();

  return useMutation<DriverNotificationSettingsResponse, Error>({
    mutationFn: async () => {
      const response = await apiFetchClient.put<DriverNotificationSettingsResponse>(
        DRIVER_NOTIFICATION_SETTINGS_PATH,
      );

      return response.data;
    },
    onSuccess: (response) => {
      queryClient.setQueryData(DRIVER_NOTIFICATION_SETTINGS_QUERY_KEY, response);
    },
  });
};
