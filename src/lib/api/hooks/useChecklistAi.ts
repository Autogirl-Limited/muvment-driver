import { useMutation, useQuery, useQueryClient, type Query } from "@tanstack/react-query";

import { apiFetchClient } from "../client";
import type {
  ChecklistAiStatus,
  ChecklistType,
  ConditionReport,
  ConditionReportResponse,
  DashboardReading,
  DashboardReadingResponse,
  PhotoCheck,
  PhotoCheckResponse,
  PhotoInsight,
  PhotoInsightKind,
  PhotoInsightListResponse,
  PhotoInsightResponse,
  StartPhotoCheckPayload,
  StartPhotoInsightPayload,
} from "../types";
import { DRIVER_APP_CHECKLISTS_PATH } from "./usePreRideChecklist";

/**
 * Server-side checklist AI. The photo is read on the server once it is
 * uploaded; these hooks start the work and follow it, polling briefly while a
 * job runs so the answer appears as soon as it is ready.
 */
export const CHECKLIST_AI_QUERY_KEY = ["checklist-ai"] as const;

const encode = encodeURIComponent;

const photoCheckKey = (imageUrl: string | undefined) => [...CHECKLIST_AI_QUERY_KEY, "photo-check", imageUrl ?? ""] as const;
const conditionReportKey = (trackerId: string | undefined, type: ChecklistType) =>
  [...CHECKLIST_AI_QUERY_KEY, "condition-report", trackerId ?? "", type] as const;
const photoInsightKey = (imageUrl: string | undefined, kind?: PhotoInsightKind) =>
  [...CHECKLIST_AI_QUERY_KEY, "photo-insight", imageUrl ?? "", kind ?? "any"] as const;
const reportInsightsKey = (trackerId: string | undefined, type: ChecklistType) =>
  [...CHECKLIST_AI_QUERY_KEY, "report-insights", trackerId ?? "", type] as const;

/** Quick at first (results usually take a few seconds), then gentler. */
const pollWhileProcessing = <T extends { status: ChecklistAiStatus } | null | undefined>(
  query: Query<T, Error, T, readonly unknown[]>,
) => {
  if (query.state.data?.status !== "PROCESSING") return false;
  return query.state.dataUpdateCount < 10 ? 1_200 : 3_000;
};

export const useStartPhotoCheck = () => {
  const queryClient = useQueryClient();

  return useMutation<PhotoCheck, Error, StartPhotoCheckPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<PhotoCheckResponse, StartPhotoCheckPayload>(
        `${DRIVER_APP_CHECKLISTS_PATH}/photo-checks`,
        payload,
      );
      const check = response.data.data;
      if (!check) throw new Error("The photo check could not be started.");
      return check;
    },
    onSuccess: (check, { imageUrl }) => {
      queryClient.setQueryData(photoCheckKey(imageUrl), check);
    },
  });
};

/** The damage check of one exterior photo, polled while it runs. */
export const usePhotoCheck = (imageUrl: string | undefined, options: { enabled?: boolean } = {}) =>
  useQuery<PhotoCheck | null, Error>({
    queryKey: photoCheckKey(imageUrl),
    queryFn: async () => {
      const response = await apiFetchClient.get<PhotoCheckResponse>(
        `${DRIVER_APP_CHECKLISTS_PATH}/photo-checks?imageUrl=${encode(imageUrl ?? "")}`,
      );
      return response.data.data ?? null;
    },
    enabled: Boolean(imageUrl) && (options.enabled ?? true),
    refetchInterval: pollWhileProcessing,
    retry: false,
    staleTime: 10_000,
  });

/** The car's condition for a submitted exterior report, compared with its last report. */
export const useConditionReport = (
  trackerId: string | undefined,
  checklistType: ChecklistType,
  options: { enabled?: boolean } = {},
) =>
  useQuery<ConditionReport | null, Error>({
    queryKey: conditionReportKey(trackerId, checklistType),
    queryFn: async () => {
      const response = await apiFetchClient.get<ConditionReportResponse>(
        `${DRIVER_APP_CHECKLISTS_PATH}/${encode(trackerId ?? "")}/condition-report?checklistType=${checklistType}`,
      );
      return response.data.data ?? null;
    },
    enabled: Boolean(trackerId) && (options.enabled ?? true),
    refetchInterval: pollWhileProcessing,
    retry: false,
    staleTime: 10_000,
  });

/** Starts the AI's analysis of a photo (damage, accessory, fluids, safety gear, selfie). */
export const useStartPhotoInsight = () => {
  const queryClient = useQueryClient();

  return useMutation<PhotoInsight, Error, StartPhotoInsightPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<PhotoInsightResponse, StartPhotoInsightPayload>(
        `${DRIVER_APP_CHECKLISTS_PATH}/photo-insights`,
        payload,
      );
      const insight = response.data.data;
      if (!insight) throw new Error("The photo analysis could not be started.");
      return insight;
    },
    onSuccess: (insight, { imageUrl, kind }) => {
      queryClient.setQueryData(photoInsightKey(imageUrl, kind), insight);
    },
  });
};

/** The analysis of one photo, polled while it runs. */
export const usePhotoInsight = (
  imageUrl: string | undefined,
  kind: PhotoInsightKind,
  options: { enabled?: boolean } = {},
) =>
  useQuery<PhotoInsight | null, Error>({
    queryKey: photoInsightKey(imageUrl, kind),
    queryFn: async () => {
      const response = await apiFetchClient.get<PhotoInsightResponse>(
        `${DRIVER_APP_CHECKLISTS_PATH}/photo-insights?imageUrl=${encode(imageUrl ?? "")}&kind=${kind}`,
      );
      return response.data.data ?? null;
    },
    enabled: Boolean(imageUrl) && (options.enabled ?? true),
    refetchInterval: pollWhileProcessing,
    retry: false,
    staleTime: 10_000,
  });

/** Every analysed photo saved in this report, worst first. */
export const useReportInsights = (
  trackerId: string | undefined,
  checklistType: ChecklistType,
  options: { enabled?: boolean } = {},
) =>
  useQuery<PhotoInsight[], Error>({
    queryKey: reportInsightsKey(trackerId, checklistType),
    queryFn: async () => {
      const response = await apiFetchClient.get<PhotoInsightListResponse>(
        `${DRIVER_APP_CHECKLISTS_PATH}/${encode(trackerId ?? "")}/photo-insights?checklistType=${checklistType}`,
      );
      return response.data.data ?? [];
    },
    enabled: Boolean(trackerId) && (options.enabled ?? true),
    refetchInterval: (query) => (query.state.data?.some((insight) => insight.status === "PROCESSING") ? 2_500 : false),
    retry: false,
    staleTime: 10_000,
  });

/* ------------------------------------------------------------ dashboard */

const dashboardReadingKey = (trackerId: string | undefined, type: ChecklistType, imageUrl?: string) =>
  [...CHECKLIST_AI_QUERY_KEY, "dashboard-reading", trackerId ?? "", type, imageUrl ?? "latest"] as const;

export const useStartDashboardReading = () => {
  const queryClient = useQueryClient();

  return useMutation<
    DashboardReading,
    Error,
    { trackerId: string; checklistType: ChecklistType; imageUrl: string; force?: boolean }
  >({
    mutationFn: async ({ trackerId, checklistType, imageUrl, force }) => {
      const response = await apiFetchClient.post<
        DashboardReadingResponse,
        { checklistType: ChecklistType; imageUrl: string; force?: boolean }
      >(`${DRIVER_APP_CHECKLISTS_PATH}/${encode(trackerId)}/dashboard-reading`, { checklistType, imageUrl, force });
      const reading = response.data.data;
      if (!reading) throw new Error("The dashboard reading could not be started.");
      return reading;
    },
    onSuccess: (reading, { trackerId, checklistType, imageUrl }) => {
      queryClient.setQueryData(dashboardReadingKey(trackerId, checklistType, imageUrl), reading);
      queryClient.setQueryData(dashboardReadingKey(trackerId, checklistType), reading);
    },
  });
};

/** The reading of one dashboard photo (or the latest for the report). Polls while the server is still reading it. */
export const useDashboardReading = (
  trackerId: string | undefined,
  checklistType: ChecklistType,
  imageUrl?: string,
  options: { enabled?: boolean } = {},
) =>
  useQuery<DashboardReading | null, Error>({
    queryKey: dashboardReadingKey(trackerId, checklistType, imageUrl),
    queryFn: async () => {
      const params = new URLSearchParams({ checklistType });
      if (imageUrl) params.set("imageUrl", imageUrl);
      const response = await apiFetchClient.get<DashboardReadingResponse>(
        `${DRIVER_APP_CHECKLISTS_PATH}/${encode(trackerId ?? "")}/dashboard-reading?${params.toString()}`,
      );
      return response.data.data ?? null;
    },
    enabled: Boolean(trackerId) && (options.enabled ?? true),
    refetchInterval: pollWhileProcessing,
    retry: false,
    staleTime: 5_000,
  });
