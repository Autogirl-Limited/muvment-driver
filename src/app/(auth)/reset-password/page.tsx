"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { NavBar, Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useForgotPassword } from "@/lib/api/hooks/useAuth";
import { usePasswordReset } from "@/providers/PasswordResetProvider";
import { useToast } from "@/providers/ToastProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const forgotPassword = useForgotPassword();
  const passwordReset = usePasswordReset();

  const isFormValid = email.trim().length > 0;
  const backendError = getApiErrorMessage(forgotPassword.error);

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFormValid || forgotPassword.isPending) {
      return;
    }

    try {
      const trimmedEmail = email.trim();

      await forgotPassword.mutateAsync({ email: trimmedEmail });
      passwordReset.setEmail(trimmedEmail);
      passwordReset.setOtp("");
      toast.success("Verification code sent");
      router.push("/verify-code");
    } catch (error) {
      toast.error("Failed to send code", getApiErrorMessage(error) || "Please check the email and try again");
    }
  };

  return (
    <Screen>
      <NavBar left={<BackButton href="/login" />} />
      <div className="anim-rise-in px-6 pt-2">
        <h1 className="text-large-title mb-2 text-text">Reset your password</h1>
        <p className="text-body mb-8 text-text-2">
          Enter your email address and we&apos;ll send you a verification code
        </p>

        <form onSubmit={handleSendCode} noValidate>
          <TextField
            label="Email Address"
            placeholder="Enter your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            hasError={Boolean(backendError)}
            errorMessage={backendError}
          />

          <div className="mt-2">
            <Button type="submit" disabled={!isFormValid} loading={forgotPassword.isPending}>
              {forgotPassword.isPending ? "Sending..." : "Send Verification Code"}
            </Button>
          </div>

          <div className="mt-10 text-center">
            <Link href="/login" className="text-body pressable-soft font-medium text-accent">
              Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </Screen>
  );
}
