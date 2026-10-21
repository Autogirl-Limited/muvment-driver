"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { OTPInput } from "@/components/ui/OTPInput";
import { NavBar, Screen } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useForgotPassword } from "@/lib/api/hooks/useAuth";
import { usePasswordReset } from "@/providers/PasswordResetProvider";
import { useToast } from "@/providers/ToastProvider";

const RESEND_TIMER_SECONDS = 120;

const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export default function VerifyCodePage() {
  const router = useRouter();
  const toast = useToast();
  const [otpCode, setOtpCode] = useState("");
  const [timer, setTimer] = useState(RESEND_TIMER_SECONDS);
  const forgotPassword = useForgotPassword();
  const passwordReset = usePasswordReset();

  const isFormValid = otpCode.length === 6;
  const maskedEmail = passwordReset.email
    ? passwordReset.email.replace(/^(.).+(@.+)$/, "$1***$2")
    : "your email";

  useEffect(() => {
    if (timer <= 0) {
      return;
    }

    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const requireEmail = () => {
    if (passwordReset.email) {
      return true;
    }

    toast.error("Email is required", "Please request a new verification code");
    router.replace("/reset-password");

    return false;
  };

  const handleVerify = () => {
    if (!requireEmail()) {
      return;
    }

    passwordReset.setOtp(otpCode);
    toast.success("Successful");
    router.replace("/create-password");
  };

  const handleResendCode = async () => {
    if (!requireEmail()) {
      return;
    }

    try {
      await forgotPassword.mutateAsync({ email: passwordReset.email });
      setTimer(RESEND_TIMER_SECONDS);
      toast.success("Verification code sent");
    } catch (error) {
      toast.error("Failed to resend code", getApiErrorMessage(error) || "Please try again");
    }
  };

  return (
    <Screen>
      <NavBar left={<BackButton href="/reset-password" />} />
      <div className="anim-rise-in px-6 pt-2">
        <h1 className="text-large-title mb-2 text-text">Check your email</h1>
        <p className="text-body mb-8 text-text-2">
          We&apos;ve sent a 6-digit code to
          <br />
          <span className="font-medium text-text underline decoration-text-4 underline-offset-2">{maskedEmail}</span>
        </p>

        <p className="text-callout font-medium text-text">Enter OTP</p>
        <OTPInput length={6} value={otpCode} onChange={setOtpCode} />

        <Button disabled={!isFormValid} onClick={handleVerify}>
          Verify
        </Button>

        <div className="mt-6">
          {timer > 0 ? (
            <p className="text-body text-text-2">Resend Code in {formatTimer(timer)}</p>
          ) : (
            <button
              type="button"
              disabled={forgotPassword.isPending}
              onClick={handleResendCode}
              className="text-body pressable-soft font-medium text-accent"
            >
              {forgotPassword.isPending ? "Resending..." : "Didn't get code? Resend"}
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}
