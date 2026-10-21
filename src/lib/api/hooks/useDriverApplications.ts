import { useMutation } from "@tanstack/react-query";

import { apiFetchClient, DRIVER_APPLICATIONS_PATH } from "../client";
import type { DriverApplicationPayload, DriverApplicationResponse } from "../types";

export const useCreateDriverApplication = () =>
  useMutation<DriverApplicationResponse, Error, DriverApplicationPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<DriverApplicationResponse>(
        DRIVER_APPLICATIONS_PATH,
        payload,
      );

      return response.data;
    },
  });
