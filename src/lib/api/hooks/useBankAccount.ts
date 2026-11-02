import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetchClient } from "../client";
import type {
  BanksResponse,
  DriverBankAccountOverviewResponse,
  OtpChannel,
  RequestBankOtpResponse,
  ResolveBankAccountResponse,
  SaveBankAccountPayload,
  SaveBankAccountResponse,
} from "../types";

export const DRIVER_BANK_ACCOUNT_PATH = "/driver-app/payments/bank-account";
export const BANKS_PATH = "/banks";

export const DRIVER_BANK_ACCOUNT_QUERY_KEY = ["driver-bank-account"] as const;

export const useBankAccount = () =>
  useQuery<DriverBankAccountOverviewResponse, Error>({
    queryKey: DRIVER_BANK_ACCOUNT_QUERY_KEY,
    queryFn: async () => {
      const response = await apiFetchClient.get<DriverBankAccountOverviewResponse>(DRIVER_BANK_ACCOUNT_PATH);
      return response.data;
    },
    staleTime: 60_000,
  });

/** The full bank list is fetched once and filtered on the phone. */
export const useBanks = (enabled = true) =>
  useQuery<BanksResponse, Error>({
    queryKey: ["banks"],
    queryFn: async () => {
      const response = await apiFetchClient.get<BanksResponse>(BANKS_PATH);
      return response.data;
    },
    enabled,
    staleTime: 24 * 60 * 60_000,
  });

export const useResolveBankAccount = ({ accountNumber, bankCode }: { accountNumber: string; bankCode?: string }) =>
  useQuery<ResolveBankAccountResponse, Error>({
    queryKey: ["driver-bank-account-resolve", bankCode, accountNumber],
    queryFn: async () => {
      const params = new URLSearchParams({ bankCode: bankCode ?? "", accountNumber });
      const response = await apiFetchClient.get<ResolveBankAccountResponse>(
        `${DRIVER_BANK_ACCOUNT_PATH}/resolve?${params.toString()}`,
      );
      return response.data;
    },
    enabled: Boolean(bankCode) && /^\d{10}$/.test(accountNumber),
    retry: false,
    staleTime: 10 * 60_000,
  });

export const useRequestBankOtp = () =>
  useMutation<RequestBankOtpResponse, Error, OtpChannel>({
    mutationFn: async (channel) => {
      const response = await apiFetchClient.post<RequestBankOtpResponse>(`${DRIVER_BANK_ACCOUNT_PATH}/request-otp`, {
        channel,
      });
      return response.data;
    },
  });

export const useSaveBankAccount = () => {
  const queryClient = useQueryClient();

  return useMutation<SaveBankAccountResponse, Error, SaveBankAccountPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.put<SaveBankAccountResponse, SaveBankAccountPayload>(
        DRIVER_BANK_ACCOUNT_PATH,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DRIVER_BANK_ACCOUNT_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["driver-payments"] });
    },
  });
};
