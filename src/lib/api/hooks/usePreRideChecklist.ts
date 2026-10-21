import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetchClient } from "../client";
import { syncTrackingWithStatus } from "../../tracking/useTripTracker";
import type {
  ApiErrorResponse,
  ChecklistTrackersResponse,
  ChecklistType,
  ChecklistStepResponse,
  DriverTripDetailsResponse,
  DriverTripStatus,
  PreRideChecklistSummary,
  PostRideChecklistAggregateResponse,
  PreRideChecklistSummaryResponse,
  SubmitDriverPhotoChecklistPayload,
  SubmitExteriorChecklistPayload,
  SubmitInteriorChecklistPayload,
  SubmitChecklistResponse,
  SubmitVehicleHealthChecklistPayload,
  TodayChecklistResponse,
  TransitionDriverTripStatusResponse,
  UpdateInteriorMetadataPayload,
  VehicleFeaturesResponse,
} from "../types";

export const DRIVER_APP_CHECKLISTS_PATH = "/driver-app/checklists";
export const VEHICLE_FEATURES_PATH = "/public/vehicle-features";

export const PRE_RIDE_CHECKLIST_SUMMARY_QUERY_KEY = [
  "pre-ride-checklist-summary",
] as const;

export const POST_RIDE_CHECKLIST_AGGREGATE_QUERY_KEY = [
  "post-ride-checklist-aggregate",
] as const;

export const CHECKLIST_TRACKERS_QUERY_KEY = [
  "checklist-trackers",
] as const;

export const TODAY_CHECKLIST_QUERY_KEY = ["today-checklist"] as const;

const buildChecklistPath = (trackerId: string, step: string) =>
  `${DRIVER_APP_CHECKLISTS_PATH}/${encodeURIComponent(trackerId)}/${step}`;

const buildChecklistTrackersPath = ({
  from,
  page = 0,
  size = 1,
  to,
}: {
  from: string;
  page?: number;
  size?: number;
  to: string;
}) => {
  const params = new URLSearchParams();

  params.set("from", from);
  params.set("to", to);
  params.set("page", String(page));
  params.set("size", String(size));

  return `${DRIVER_APP_CHECKLISTS_PATH}/tracker?${params.toString()}`;
};

const VEHICLE_FEATURES_QUERY_KEY = ["vehicle-features"] as const;

const buildChecklistStepSubmitPath = (step: string) =>
  `${DRIVER_APP_CHECKLISTS_PATH}/${step}`;

const buildChecklistTrackerPath = (trackerId: string, step: string) =>
  `${DRIVER_APP_CHECKLISTS_PATH}/${encodeURIComponent(trackerId)}/${step}`;

const buildTransitionPath = (
  tripId: string,
  driverTripStatus: DriverTripStatus,
) => {
  const params = new URLSearchParams();

  params.set("driverTripStatus", driverTripStatus);

  return `${buildChecklistPath(tripId, "transition")}?${params.toString()}`;
};

const logChecklistSubmit = ({
  checklistType,
  photoCount,
  step,
  trackerId,
}: {
  checklistType?: string;
  photoCount?: number;
  step: string;
  trackerId: string;
}) => {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log("[checklist:submit]", {
    checklistType,
    photoCount,
    step,
    trackerId,
  });
};

const createIdempotencyKey = (step: string, trackerId: string) =>
  `${step}-${trackerId}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

const withOptionalChecklistTrackerId = <
  TPayload extends { checklistTrackerId?: string },
>(
  payload: TPayload,
  trackerId?: string,
) => {
  const trimmedTrackerId = trackerId?.trim();

  return {
    ...payload,
    ...(payload.checklistTrackerId || !trimmedTrackerId
      ? {}
      : { checklistTrackerId: trimmedTrackerId }),
  };
};

const getPreRideChecklistSummaryQueryKey = (trackerId?: string) => [
  ...PRE_RIDE_CHECKLIST_SUMMARY_QUERY_KEY,
  trackerId,
];

const getPostRideChecklistAggregateQueryKey = (trackerId?: string) => [
  ...POST_RIDE_CHECKLIST_AGGREGATE_QUERY_KEY,
  trackerId,
];

const createEmptyPreRideChecklistSummaryResponse = (): PreRideChecklistSummaryResponse => ({
  data: {
    driverPhoto: {
      photosCaptured: 0,
      valid: false,
    },
    exteriorPhotos: {
      photosCaptured: 0,
      valid: false,
    },
    interiorPhotos: {
      photosCaptured: 0,
      valid: false,
    },
    totalCompletionTime: "Unavailable",
    vehicleHealthCheckPhotos: {
      photosCaptured: 0,
      valid: false,
    },
    vehicleInfo: {
      vehicleIdentifier: "",
      vehicleName: "",
    },
  },
  message: "No checklist progress found for this tracker.",
  status: "SUCCESSFUL",
  timestamp: new Date().toISOString(),
});

const isPreRideChecklistSummaryResponse = (
  response: unknown,
): response is PreRideChecklistSummaryResponse => {
  const data = (response as { data?: Partial<PreRideChecklistSummary> }).data;

  return Boolean(
    data?.driverPhoto &&
      data.exteriorPhotos &&
      data.interiorPhotos &&
      data.vehicleHealthCheckPhotos,
  );
};

const invalidateChecklistQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  trackerId: string,
) => {
  void queryClient.invalidateQueries({
    queryKey: getPreRideChecklistSummaryQueryKey(trackerId),
  });
  void queryClient.invalidateQueries({
    queryKey: getPostRideChecklistAggregateQueryKey(trackerId),
  });
  void queryClient.invalidateQueries({
    queryKey: CHECKLIST_TRACKERS_QUERY_KEY,
  });
  void queryClient.invalidateQueries({
    queryKey: TODAY_CHECKLIST_QUERY_KEY,
  });
};

const withChecklistTimestamps = <
  TPayload extends { capturedAt?: string; completedAt?: string },
>(
  payload: TPayload,
) => {
  const timestamp = new Date().toISOString();

  return {
    ...payload,
    capturedAt: payload.capturedAt ?? timestamp,
    completedAt: payload.completedAt ?? timestamp,
  };
};

export const usePreRideChecklistSummary = (
  trackerId?: string,
  options: { enabled?: boolean } = {},
) =>
  useQuery<PreRideChecklistSummaryResponse, Error>({
    queryKey: getPreRideChecklistSummaryQueryKey(trackerId),
    queryFn: async () => {
      if (!trackerId) {
        throw new Error("Missing checklist tracker ID.");
      }

      const response = await apiFetchClient.request<
        PreRideChecklistSummaryResponse | ApiErrorResponse
      >(buildChecklistPath(trackerId, "summary"), {
        acceptedStatuses: [404],
        method: "GET",
        silent: true,
      });

      if (isPreRideChecklistSummaryResponse(response)) {
        return response;
      }

      return createEmptyPreRideChecklistSummaryResponse();
    },
    enabled: Boolean(trackerId) && (options.enabled ?? true),
    retry: false,
    staleTime: 15_000,
  });

export const usePostRideChecklistAggregate = (
  trackerId?: string,
  options: { enabled?: boolean } = {},
) =>
  useQuery<PostRideChecklistAggregateResponse, Error>({
    queryKey: getPostRideChecklistAggregateQueryKey(trackerId),
    queryFn: async () => {
      if (!trackerId) {
        throw new Error("Missing checklist tracker ID.");
      }

      const response =
        await apiFetchClient.get<PostRideChecklistAggregateResponse>(
          buildChecklistPath(trackerId, "aggregate"),
        );

      return response.data;
    },
    enabled: Boolean(trackerId) && (options.enabled ?? true),
    staleTime: 15_000,
  });

export const useTodayChecklist = () =>
  useQuery<TodayChecklistResponse, Error>({
    queryKey: TODAY_CHECKLIST_QUERY_KEY,
    queryFn: async () => {
      const response = await apiFetchClient.get<TodayChecklistResponse>(
        `${DRIVER_APP_CHECKLISTS_PATH}/today`,
      );

      return response.data;
    },
    staleTime: 15_000,
  });

export const useChecklistTrackers = ({
  enabled = true,
  from,
  page = 0,
  size = 1,
  to,
}: {
  enabled?: boolean;
  from?: string;
  page?: number;
  size?: number;
  to?: string;
}) =>
  useQuery<ChecklistTrackersResponse, Error>({
    queryKey: [...CHECKLIST_TRACKERS_QUERY_KEY, { from, page, size, to }],
    queryFn: async () => {
      if (!from || !to) {
        throw new Error("Missing checklist tracker date range.");
      }

      const response = await apiFetchClient.get<ChecklistTrackersResponse>(
        buildChecklistTrackersPath({
          from,
          page,
          size,
          to,
        }),
      );

      return response.data;
    },
    enabled: Boolean(from && to) && enabled,
    staleTime: 30_000,
  });

export const useVehicleFeatures = (
  vehicleId?: string | null,
  options: { enabled?: boolean } = {},
) =>
  useQuery<VehicleFeaturesResponse, Error>({
    queryKey: [...VEHICLE_FEATURES_QUERY_KEY, vehicleId?.trim() || "all"],
    queryFn: async () => {
      const trimmedVehicleId = vehicleId?.trim();
      const path = trimmedVehicleId
        ? `${VEHICLE_FEATURES_PATH}/${encodeURIComponent(trimmedVehicleId)}`
        : VEHICLE_FEATURES_PATH;
      const response = await apiFetchClient.get<VehicleFeaturesResponse>(
        path,
      );

      return response.data;
    },
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });

export const useSubmitExteriorChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ChecklistStepResponse,
    Error,
    {
      idempotencyKey?: string;
      idempotencyScopeId?: string;
      payload: SubmitExteriorChecklistPayload;
      trackerId?: string;
    }
  >({
    mutationFn: async ({
      idempotencyKey,
      idempotencyScopeId,
      payload,
      trackerId,
    }) => {
      const idempotencyId =
        trackerId?.trim() || idempotencyScopeId?.trim() || "new-checklist";

      logChecklistSubmit({
        checklistType: payload.checklistType,
        photoCount: payload.uploadPhotos.length,
        step: "exterior",
        trackerId: idempotencyId,
      });

      const response = await apiFetchClient.post<
        ChecklistStepResponse,
        SubmitExteriorChecklistPayload
      >(
        buildChecklistStepSubmitPath("exterior"),
        withChecklistTimestamps(withOptionalChecklistTrackerId(payload, trackerId)),
        {
          "Idempotency-Key":
            idempotencyKey ?? createIdempotencyKey("exterior", idempotencyId),
        },
      );

      return response.data;
    },
    onSuccess: (response, { trackerId }) => {
      const resolvedTrackerId =
        trackerId?.trim() || response.data.checklistTrackerId?.trim();

      if (resolvedTrackerId) {
        invalidateChecklistQueries(queryClient, resolvedTrackerId);
      } else {
        void queryClient.invalidateQueries({
          queryKey: TODAY_CHECKLIST_QUERY_KEY,
        });
      }
    },
  });
};

export const useSubmitInteriorChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ChecklistStepResponse,
    Error,
    {
      idempotencyKey?: string;
      payload: SubmitInteriorChecklistPayload;
      trackerId: string;
    }
  >({
    mutationFn: async ({ idempotencyKey, payload, trackerId }) => {
      logChecklistSubmit({
        checklistType: payload.checklistType,
        photoCount: payload.uploadPhotos.length,
        step: "interior",
        trackerId,
      });

      const response = await apiFetchClient.post<
        ChecklistStepResponse,
        SubmitInteriorChecklistPayload
      >(
        buildChecklistStepSubmitPath("interior"),
        withChecklistTimestamps({
          ...payload,
          checklistTrackerId: payload.checklistTrackerId ?? trackerId,
        }),
        {
          "Idempotency-Key":
            idempotencyKey ?? createIdempotencyKey("interior", trackerId),
        },
      );

      return response.data;
    },
    onSuccess: (_response, { trackerId }) => {
      invalidateChecklistQueries(queryClient, trackerId);
    },
  });
};

export const useUpdateInteriorMetadata = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ChecklistStepResponse,
    Error,
    { payload: UpdateInteriorMetadataPayload; trackerId: string }
  >({
    mutationFn: async ({ payload, trackerId }) => {
      logChecklistSubmit({
        checklistType: payload.checklistType,
        step: "interior-correction",
        trackerId,
      });

      const response = await apiFetchClient.patch<
        ChecklistStepResponse,
        UpdateInteriorMetadataPayload
      >(
        buildChecklistStepSubmitPath("interior"),
        payload,
        {
          "Idempotency-Key": createIdempotencyKey("interior-correction", trackerId),
        },
      );

      return response.data;
    },
    onSuccess: (_response, { trackerId }) => {
      invalidateChecklistQueries(queryClient, trackerId);
    },
  });
};

export const useReanalyzeInteriorChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ChecklistStepResponse,
    Error,
    { checklistType: ChecklistType; trackerId: string }
  >({
    mutationFn: async ({ checklistType, trackerId }) => {
      const response = await apiFetchClient.post<
        ChecklistStepResponse,
        { checklistType: ChecklistType }
      >(
        buildChecklistTrackerPath(trackerId, "analyze"),
        { checklistType },
      );

      return response.data;
    },
    onSuccess: (_response, { trackerId }) => {
      invalidateChecklistQueries(queryClient, trackerId);
    },
  });
};

export const useSubmitVehicleHealthChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ChecklistStepResponse,
    Error,
    {
      idempotencyKey?: string;
      payload: SubmitVehicleHealthChecklistPayload;
      trackerId: string;
    }
  >({
    mutationFn: async ({ idempotencyKey, payload, trackerId }) => {
      logChecklistSubmit({
        photoCount: payload.uploadPhotos.length,
        step: "vehicle-health-check",
        trackerId,
      });

      const response = await apiFetchClient.post<
        ChecklistStepResponse,
        SubmitVehicleHealthChecklistPayload
      >(
        buildChecklistStepSubmitPath("vehicle-health-check"),
        withChecklistTimestamps({
          ...payload,
          checklistTrackerId: payload.checklistTrackerId ?? trackerId,
        }),
        {
          "Idempotency-Key":
            idempotencyKey ??
            createIdempotencyKey("vehicle-health-check", trackerId),
        },
      );

      return response.data;
    },
    onSuccess: (_response, { trackerId }) => {
      invalidateChecklistQueries(queryClient, trackerId);
    },
  });
};

export const useSubmitDriverPhotoChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ChecklistStepResponse,
    Error,
    {
      idempotencyKey?: string;
      payload: SubmitDriverPhotoChecklistPayload;
      trackerId: string;
    }
  >({
    mutationFn: async ({ idempotencyKey, payload, trackerId }) => {
      logChecklistSubmit({
        photoCount: payload.uploadPhotos.length,
        step: "driver-photo",
        trackerId,
      });

      const response = await apiFetchClient.post<
        ChecklistStepResponse,
        SubmitDriverPhotoChecklistPayload
      >(
        buildChecklistStepSubmitPath("driver-photo"),
        withChecklistTimestamps({
          ...payload,
          checklistTrackerId: payload.checklistTrackerId ?? trackerId,
        }),
        {
          "Idempotency-Key":
            idempotencyKey ?? createIdempotencyKey("driver-photo", trackerId),
        },
      );

      return response.data;
    },
    onSuccess: (_response, { trackerId }) => {
      invalidateChecklistQueries(queryClient, trackerId);
    },
  });
};

export const useSubmitChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation<
    SubmitChecklistResponse,
    Error,
    { checklistType: ChecklistType; trackerId: string }
  >({
    mutationFn: async ({ checklistType, trackerId }) => {
      logChecklistSubmit({
        step: "submit",
        trackerId,
      });

      const response =
        await apiFetchClient.post<
          SubmitChecklistResponse,
          { checklistType: ChecklistType }
        >(
          buildChecklistTrackerPath(trackerId, "submit"),
          { checklistType },
        );

      return response.data;
    },
    onSuccess: (_response, { trackerId }) => {
      invalidateChecklistQueries(queryClient, trackerId);
      void queryClient.invalidateQueries({
        queryKey: ["driver-trips"],
      });
    },
  });
};

export const useTransitionDriverTripStatus = () => {
  const queryClient = useQueryClient();

  return useMutation<
    TransitionDriverTripStatusResponse,
    Error,
    { driverTripStatus: DriverTripStatus; tripId: string }
  >({
    mutationFn: async ({ driverTripStatus, tripId }) => {
      const response =
        await apiFetchClient.put<TransitionDriverTripStatusResponse>(
          buildTransitionPath(tripId, driverTripStatus),
        );

      return response.data;
    },
    onSuccess: (response, { tripId }) => {
      queryClient.setQueryData<DriverTripDetailsResponse>(
        ["driver-trip", tripId],
        (currentTrip) => {
          if (!currentTrip?.data) {
            return currentTrip;
          }

          return {
            ...currentTrip,
            data: {
              ...currentTrip.data,
              driverTripStatus: response.data.driverTripStatus,
            },
          };
        },
      );
      // Start or stop sharing the driver's location with the passenger's live map.
      syncTrackingWithStatus(tripId, response.data.driverTripStatus);
      invalidateChecklistQueries(queryClient, tripId);
      void queryClient.invalidateQueries({
        queryKey: ["driver-trip", tripId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["driver-trips"],
      });
    },
  });
};
