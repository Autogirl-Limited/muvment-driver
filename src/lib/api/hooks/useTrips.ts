import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetchClient } from "../client";
import type {
  CreateIncidentReportPayload,
  CreateIncidentReportResponse,
  DriverTripDetailsResponse,
  DriverTripStatisticsResponse,
  DriverTripsQueryParams,
  DriverTripsResponse,
  IncidentReportsResponse,
} from "../types";

export const DRIVER_APP_TRIPS_PATH = "/driver-app/trips";
export const DRIVER_APP_TRIP_STATISTICS_PATH =
  `${DRIVER_APP_TRIPS_PATH}/statistics`;

const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 10;

const buildDriverTripsPath = ({
  endDate,
  page = DEFAULT_PAGE,
  search,
  size = DEFAULT_PAGE_SIZE,
  startDate,
  tripStatus,
}: DriverTripsQueryParams) => {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("size", String(size));

  if (tripStatus) {
    params.set("tripStatus", tripStatus);
  }

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  if (startDate) {
    params.set("startDate", startDate);
  }

  if (endDate) {
    params.set("endDate", endDate);
  }

  return `${DRIVER_APP_TRIPS_PATH}?${params.toString()}`;
};

const buildDriverTripPath = (id: string) =>
  `${DRIVER_APP_TRIPS_PATH}/${encodeURIComponent(id)}`;

const buildIncidentReportsPath = ({
  page = DEFAULT_PAGE,
  size = DEFAULT_PAGE_SIZE,
  tripId,
}: {
  page?: number;
  size?: number;
  tripId?: string;
}) => {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("size", String(size));

  if (tripId?.trim()) {
    params.set("tripId", tripId.trim());
  }

  return `${DRIVER_APP_TRIPS_PATH}/report?${params.toString()}`;
};

export const useDriverTrips = (params: DriverTripsQueryParams = {}) =>
  useQuery<DriverTripsResponse, Error>({
    queryKey: ["driver-trips", params],
    queryFn: async () => {
      const response = await apiFetchClient.get<DriverTripsResponse>(
        buildDriverTripsPath(params),
      );

      return response.data;
    },
    staleTime: 30_000,
  });

export const useDriverTrip = (id?: string) =>
  useQuery<DriverTripDetailsResponse, Error>({
    queryKey: ["driver-trip", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Missing trip ID.");
      }

      const response = await apiFetchClient.get<DriverTripDetailsResponse>(
        buildDriverTripPath(id),
      );

      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

export const useDriverTripStatistics = () =>
  useQuery<DriverTripStatisticsResponse, Error>({
    queryKey: ["driver-trip-statistics"],
    queryFn: async () => {
      const response =
        await apiFetchClient.get<DriverTripStatisticsResponse>(
          DRIVER_APP_TRIP_STATISTICS_PATH,
        );

      return response.data;
    },
    staleTime: 30_000,
  });

export const useIncidentReports = ({
  enabled = true,
  page = DEFAULT_PAGE,
  size = DEFAULT_PAGE_SIZE,
  tripId,
}: {
  enabled?: boolean;
  page?: number;
  size?: number;
  tripId?: string;
} = {}) =>
  useQuery<IncidentReportsResponse, Error>({
    queryKey: ["driver-trip-reports", { page, size, tripId }],
    queryFn: async () => {
      const response = await apiFetchClient.get<IncidentReportsResponse>(
        buildIncidentReportsPath({ page, size, tripId }),
      );

      return response.data;
    },
    enabled,
    staleTime: 30_000,
  });

export const useCreateIncidentReport = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CreateIncidentReportResponse,
    Error,
    { payload: CreateIncidentReportPayload; tripId: string }
  >({
    mutationFn: async ({ payload, tripId }) => {
      const response = await apiFetchClient.post<
        CreateIncidentReportResponse,
        CreateIncidentReportPayload
      >(`${buildDriverTripPath(tripId)}/report`, payload);

      return response.data;
    },
    onSuccess: (_response, { tripId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["driver-trip-reports"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["driver-trip", tripId],
      });
    },
  });
};
