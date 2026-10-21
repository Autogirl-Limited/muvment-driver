"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { AlertDialog } from "@/components/ui/Dialog";
import {
  isPasswordValid,
  PasswordRequirementChecklist,
} from "@/components/ui/PasswordRequirementChecklist";
import { NavBar, Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useChangePassword } from "@/lib/api/hooks/useUsers";
import { useToast } from "@/providers/ToastProvider";

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [isConfirmVisible, setConfirmVisible] = useState(false);
  const changePassword = useChangePassword();

  const passwordsMatch = newPassword === confirmPassword;
  const passwordsDiffer = oldPassword.length > 0 && newPassword.length > 0 && oldPassword !== newPassword;
  const showMatchError = confirmPassword.length > 0 && !passwordsMatch;
  const showSamePasswordError = oldPassword.length > 0 && newPassword.length > 0 && !passwordsDiffer;
  const backendError = getApiErrorMessage(changePassword.error);
  const isFormValid = oldPassword.length > 0 && isPasswordValid(newPassword) && passwordsMatch && passwordsDiffer;
  const isSubmitDisabled = !isFormValid || changePassword.isPending;
  const shouldShowPasswordRequirements = showPasswordRequirements || newPassword.length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!isSubmitDisabled) {
      setConfirmVisible(true);
    }
  };

  const handleConfirm = async () => {
    if (!isFormValid || changePassword.isPending) {
      return;
    }

    setConfirmVisible(false);

    try {
      const response = await changePassword.mutateAsync({ newPassword, oldPassword });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(response.message || "Password changed successfully");
      router.replace("/settings");
    } catch (error) {
      toast.error("Failed to change password", getApiErrorMessage(error) || "Please try again");
    }
  };

  return (
    <Screen>
      <NavBar left={<BackButton href="/settings" />} />
      <div className="anim-rise-in px-6 pt-2 pb-10">
        <h1 className="text-large-title mb-2 text-text">Change password</h1>
        <p className="text-body mb-8 text-text-2">
          Use a strong password that is different from your current password.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            label="Current Password"
            placeholder="Enter current password"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            isPassword
            autoComplete="current-password"
            hasError={Boolean(backendError)}
            errorMessage={backendError}
          />
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
            hasError={showSamePasswordError}
            errorMessage={showSamePasswordError ? "New password must be different from current password" : undefined}
          />
          <TextField
            label="Confirm New Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            isPassword
            autoComplete="new-password"
            hasError={showMatchError}
            errorMessage={showMatchError ? "Passwords do not match" : undefined}
          />

          {shouldShowPasswordRequirements && <PasswordRequirementChecklist password={newPassword} />}

          <Button type="submit" disabled={isSubmitDisabled} loading={changePassword.isPending}>
            {changePassword.isPending ? "Changing password..." : "Change Password"}
          </Button>
        </form>
      </div>

      <AlertDialog
        open={isConfirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={() => void handleConfirm()}
        title="Change Password"
        message="Are you sure you want to change your account password?"
        confirmText="Change"
      />
    </Screen>
  );
}
