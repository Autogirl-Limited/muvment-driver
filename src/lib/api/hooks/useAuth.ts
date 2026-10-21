import { useMutation } from "@tanstack/react-query";

import {
  apiFetchClient,
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_RESEND_VERIFICATION_OTP_PATH,
  AUTH_RESET_PASSWORD_PATH,
  AUTH_VERIFY_ACCOUNT_PATH,
} from "../client";
import type {
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  ResendVerificationOtpPayload,
  ResendVerificationOtpResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
  VerifyAccountPayload,
  VerifyAccountResponse,
} from "../types";

// Login itself goes through NextAuth (see `src/auth.ts`), which stores the
// backend tokens in the session cookie. The hooks here cover the public
// password-reset endpoints that need no session.

export const useForgotPassword = () =>
  useMutation<ForgotPasswordResponse, Error, ForgotPasswordPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<ForgotPasswordResponse>(
        AUTH_FORGOT_PASSWORD_PATH,
        payload,
      );

      return response.data;
    },
  });

export const useVerifyAccount = () =>
  useMutation<VerifyAccountResponse, Error, VerifyAccountPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<VerifyAccountResponse, VerifyAccountPayload>(
        AUTH_VERIFY_ACCOUNT_PATH,
        payload,
      );

      return response.data;
    },
  });

export const useResendVerificationOtp = () =>
  useMutation<ResendVerificationOtpResponse, Error, ResendVerificationOtpPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<
        ResendVerificationOtpResponse,
        ResendVerificationOtpPayload
      >(AUTH_RESEND_VERIFICATION_OTP_PATH, payload);

      return response.data;
    },
  });

export const useResetPassword = () =>
  useMutation<ResetPasswordResponse, Error, ResetPasswordPayload>({
    mutationFn: async (payload) => {
      const response = await apiFetchClient.post<ResetPasswordResponse>(
        AUTH_RESET_PASSWORD_PATH,
        payload,
      );

      return response.data;
    },
  });
