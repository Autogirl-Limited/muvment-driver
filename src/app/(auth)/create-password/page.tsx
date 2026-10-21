"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import {
  isPasswordValid,
  PasswordRequirementChecklist,
} from "@/components/ui/PasswordRequirementChecklist";
import { NavBar, Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useResetPassword } from "@/lib/api/hooks/useAuth";
import { usePasswordReset } from "@/providers/PasswordResetProvider";
import { useToast } from "@/providers/ToastProvider";

export default function CreatePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const resetPassword = useResetPassword();
  const passwordReset = usePasswordReset();

  const passwordsMatch = newPassword === confirmPassword;
  const showMatchError = confirmPassword.length > 0 && !passwordsMatch;
  const isFormValid = isPasswordValid(newPassword) && passwordsMatch;
  const backendError = getApiErrorMessage(resetPassword.error);
  const shouldShowPasswordRequirements = showPasswordRequirements || newPassword.length > 0;

  const handleSetPassword = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFormValid || resetPassword.isPending) {
      return;
    }

    if (!passwordReset.email || !passwordReset.otp) {
      toast.error("Verification required", "Please request and enter your verification code again");
      router.replace("/reset-password");
      return;
    }

    try {
      await resetPassword.mutateAsync({
        email: passwordReset.email,
        otp: passwordReset.otp,
        newPassword,
      });
      passwordReset.clearResetState();
      toast.success("Password Updated");
      router.replace("/login");
    } catch (error) {
      toast.error("Failed to reset password", getApiErrorMessage(error) || "Please try again");
    }
  };

  return (
    <Screen>
      <NavBar left={<BackButton label="Cancel" href="/login" />} />
      <div className="anim-rise-in px-6 pt-2 pb-10">
        <h1 className="text-large-title mb-2 text-text">Create new password</h1>
        <p className="text-body mb-8 text-text-2">
          Your new password must be different from your previous password
        </p>

        <form onSubmit={handleSetPassword} noValidate>
          <TextField
            label="New Password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(event) => {
              setShowPasswordRequirements(true);
              setNewPassword(event.target.value);
            }}
            onFocus={() => setShowPasswordRequirements(true)}
            isPassword
            autoComplete="new-password"
            hasError={showMatchError || Boolean(backendError)}
            errorMessage={backendError}
          />

          <TextField
            label="Confirm Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            isPassword
            autoComplete="new-password"
            hasError={showMatchError}
            errorMessage={showMatchError ? "Passwords do not match" : undefined}
          />

          {shouldShowPasswordRequirements && <PasswordRequirementChecklist password={newPassword} />}

          <Button type="submit" disabled={!isFormValid} loading={resetPassword.isPending}>
            {resetPassword.isPending ? "Setting password..." : "Set Password"}
          </Button>
        </form>
      </div>
    </Screen>
  );
}
