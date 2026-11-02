import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetchClient, getAccessToken, getApiBaseUrl } from "../client";
import type {
  AirportTicketOcrResponse,
  DriverPaymentRatesResponse,
  DriverPaymentRequestFilters,
  DriverPaymentRequestResponse,
  DriverPaymentRequestsPageResponse,
  DriverPaymentSummaryResponse,
  DriverPayoutDetailResponse,
  DriverPayoutsPageResponse,
  EligibleTripsResponse,
  PaymentRequestType,
  SubmitPaymentRequestPayload,
  SubmitPaymentRequestResponse,
  UpdatePaymentRequestPayload,
} from "../types";

export const DRIVER_PAYMENTS_PATH = "/driver-app/payments";

/** Every payments query key starts with this, so one invalidation refreshes the tab. */
export const DRIVER_PAYMENTS_QUERY_KEY = ["driver-payments"] as const;

const paymentsKey = (...parts: unknown[]) => [...DRIVER_PAYMENTS_QUERY_KEY, ...parts];

export const useDriverPaymentSummary = () =>
  useQuery<DriverPaymentSummaryResponse, Error>({
    queryKey: paymentsKey("summary"),
    queryFn: async () => (await apiFetchClient.get<DriverPaymentSummaryResponse>(`${DRIVER_PAYMENTS_PATH}/summary`)).data,
    staleTime: 30_000,
  });

export const useDriverPaymentRates = () =>
  useQuery<DriverPaymentRatesResponse, Error>({
    queryKey: paymentsKey("rates"),
    queryFn: async () => (await apiFetchClient.get<DriverPaymentRatesResponse>(`${DRIVER_PAYMENTS_PATH}/rates`)).data,
    staleTime: 10 * 60_000,
  });

export const useEligibleTrips = ({
  enabled = true,
  search,
  type,
}: {
  enabled?: boolean;
  search?: string;
  type?: PaymentRequestType;
}) =>
  useQuery<EligibleTripsResponse, Error>({
    queryKey: paymentsKey("eligible-trips", type, search?.trim() ?? ""),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (search?.trim()) params.set("search", search.trim());
      return (await apiFetchClient.get<EligibleTripsResponse>(`${DRIVER_PAYMENTS_PATH}/eligible-trips?${params}`)).data;
    },
    enabled: enabled && Boolean(type),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

const buildRequestsPath = ({ from, page = 0, paymentStatus, size = 20, to, type, verificationStatus }: DriverPaymentRequestFilters) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (type) params.set("type", type);
  if (verificationStatus) params.set("verificationStatus", verificationStatus);
  if (paymentStatus) params.set("paymentStatus", paymentStatus);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return `${DRIVER_PAYMENTS_PATH}/requests?${params}`;
};

export const usePaymentRequests = (filters: DriverPaymentRequestFilters = {}) =>
  useQuery<DriverPaymentRequestsPageResponse, Error>({
    queryKey: paymentsKey("requests", filters),
    queryFn: async () => (await apiFetchClient.get<DriverPaymentRequestsPageResponse>(buildRequestsPath(filters))).data,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

export const usePaymentRequest = (id?: string) =>
  useQuery<DriverPaymentRequestResponse, Error>({
    queryKey: paymentsKey("request", id),
    queryFn: async () =>
      (await apiFetchClient.get<DriverPaymentRequestResponse>(`${DRIVER_PAYMENTS_PATH}/requests/${encodeURIComponent(id ?? "")}`)).data,
    enabled: Boolean(id),
    staleTime: 15_000,
  });

export const useDriverPayouts = ({ page = 0, size = 20, enabled = true }: { page?: number; size?: number; enabled?: boolean } = {}) =>
  useQuery<DriverPayoutsPageResponse, Error>({
    queryKey: paymentsKey("payouts", page, size),
    queryFn: async () =>
      (await apiFetchClient.get<DriverPayoutsPageResponse>(`${DRIVER_PAYMENTS_PATH}/payouts?page=${page}&size=${size}`)).data,
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

export const useDriverPayout = (id?: string) =>
  useQuery<DriverPayoutDetailResponse, Error>({
    queryKey: paymentsKey("payout", id),
    queryFn: async () =>
      (await apiFetchClient.get<DriverPayoutDetailResponse>(`${DRIVER_PAYMENTS_PATH}/payouts/${encodeURIComponent(id ?? "")}`)).data,
    enabled: Boolean(id),
    staleTime: 30_000,
  });

export const useAirportTicketOcr = () =>
  useMutation<AirportTicketOcrResponse, Error, { imageUrl: string }>({
    mutationFn: async (payload) =>
      (await apiFetchClient.post<AirportTicketOcrResponse>(`${DRIVER_PAYMENTS_PATH}/ocr/airport-ticket`, payload)).data,
  });

export const useSubmitPaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<
    SubmitPaymentRequestResponse,
    Error,
    { payload: SubmitPaymentRequestPayload; idempotencyKey: string }
  >({
    mutationFn: async ({ idempotencyKey, payload }) =>
      (
        await apiFetchClient.post<SubmitPaymentRequestResponse, SubmitPaymentRequestPayload>(
          `${DRIVER_PAYMENTS_PATH}/requests`,
          payload,
          { "Idempotency-Key": idempotencyKey },
        )
      ).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DRIVER_PAYMENTS_QUERY_KEY });
    },
  });
};

export const useUpdatePaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<DriverPaymentRequestResponse, Error, { id: string; payload: UpdatePaymentRequestPayload }>({
    mutationFn: async ({ id, payload }) =>
      (
        await apiFetchClient.patch<DriverPaymentRequestResponse, UpdatePaymentRequestPayload>(
          `${DRIVER_PAYMENTS_PATH}/requests/${encodeURIComponent(id)}`,
          payload,
        )
      ).data,
    onSuccess: (response, { id }) => {
      queryClient.setQueryData(paymentsKey("request", id), response);
      void queryClient.invalidateQueries({ queryKey: DRIVER_PAYMENTS_QUERY_KEY });
    },
  });
};

export const useWithdrawPaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<DriverPaymentRequestResponse, Error, string>({
    mutationFn: async (id) =>
      (await apiFetchClient.post<DriverPaymentRequestResponse>(`${DRIVER_PAYMENTS_PATH}/requests/${encodeURIComponent(id)}/withdraw`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DRIVER_PAYMENTS_QUERY_KEY });
    },
  });
};

/**
 * Downloads a payout receipt (PDF) with the driver's token and opens it as a
 * blob URL. The new tab is opened synchronously in the tap handler so mobile
 * browsers don't block it as a pop-up, then pointed at the PDF.
 */
export const openPayoutReceipt = async (payoutId: string) => {
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null;

  try {
    const token = getAccessToken();
    const response = await fetch(
      `${getApiBaseUrl()}${DRIVER_PAYMENTS_PATH}/payouts/${encodeURIComponent(payoutId)}/receipt`,
      {
        headers: { Accept: "application/pdf", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        response.status === 404 ? "The receipt isn't ready yet." : `Couldn't load the receipt (status ${response.status}).`,
      );
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));

    if (popup && !popup.closed) {
      popup.location.href = url;
    } else {
      window.location.assign(url);
    }

    // Long enough for the viewer to load it.
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
};
