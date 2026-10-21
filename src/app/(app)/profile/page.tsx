"use client";

import { CheckCircle2 } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import { getUserDisplayName, getUserInitials } from "@/lib/utils/userProfile";

const InfoRow = ({ label, value, verified }: { label: string; value: string; verified?: boolean }) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3">
    <span className="text-callout shrink-0 text-text-3">{label}</span>
    <span className="text-body flex min-w-0 items-center gap-1.5 text-right font-medium text-text">
      <span className="truncate">{value || "—"}</span>
      {verified && <CheckCircle2 size={16} className="shrink-0 text-success" />}
    </span>
  </div>
);

export default function ProfilePage() {
  const currentUserQuery = useCurrentUser();
  const currentUser = currentUserQuery.data?.data;
  const profileErrorMessage = getApiErrorMessage(currentUserQuery.error);

  return (
    <Screen>
      <header
        className="rounded-b-[28px] bg-navy-mid px-5 pb-6"
        style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}
      >
        <BackButton tone="inverse" />
        <h1 className="text-large-title mt-4 text-white">My Profile</h1>
      </header>

      {currentUserQuery.isLoading ? (
        <div className="px-5 pt-8">
          <div className="flex flex-col items-center">
            <Skeleton className="h-28 w-28 rounded-full" />
            <Skeleton className="mt-4 h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        </div>
      ) : currentUserQuery.isError || !currentUser ? (
        <EmptyState
          title="Unable to load profile"
          description={profileErrorMessage ?? "Please check your connection and try again."}
        />
      ) : (
        <div className="anim-rise-in px-5 pb-10">
          <div className="mt-8 mb-8 flex flex-col items-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-border bg-surface-soft text-[32px] font-bold text-navy-mid shadow-card dark:text-text">
              {getUserInitials(currentUser)}
            </div>
            <h2 className="text-title-2 mt-4 text-text">{getUserDisplayName(currentUser)}</h2>
            <p className="text-callout mt-1 text-text-3">{currentUser.userType}</p>
          </div>

          <p className="text-eyebrow mb-2 ml-4 text-text-3">Personal Information</p>
          <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
            <InfoRow label="Full Name" value={getUserDisplayName(currentUser)} />
            <InfoRow label="Email" value={currentUser.email} verified={currentUser.emailVerified} />
            <InfoRow label="Phone" value={currentUser.phoneNumber} verified={currentUser.phoneVerified} />
            <InfoRow label="User Type" value={currentUser.userType} />
            <InfoRow label="Driver ID" value={currentUser.driverIdentifier} />
          </div>
        </div>
      )}
    </Screen>
  );
}
