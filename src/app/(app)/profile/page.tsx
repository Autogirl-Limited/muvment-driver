"use client";

import { useRouter } from "next/navigation";
import { Camera, CheckCircle2 } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { VerifiedTick } from "@/components/brand/VerifiedTick";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import { getUserDisplayName } from "@/lib/utils/userProfile";
import { useScreenThemeColor } from "@/providers/ThemeProvider";

/** Matches the navy profile header (--navy-mid). */
const PROFILE_HEADER_COLOR = "#1E3A5F";

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
  useScreenThemeColor(PROFILE_HEADER_COLOR);
  const router = useRouter();
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
            <button
              type="button"
              onClick={() => router.push("/profile-photo")}
              aria-label={currentUser.profilePictureUrl ? "Profile photo. Change photo" : "Add a profile photo"}
              className="pressable rounded-full"
            >
              <span className="relative inline-block">
                <UserAvatar user={currentUser} size={112} className="border border-border shadow-card" />
                {/* Camera badge, as on contact photos */}
                <span className="absolute bottom-0.5 right-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-bg bg-accent text-white">
                  <Camera size={14} />
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile-photo")}
              className="pressable-soft mt-2.5 text-[15px] font-semibold text-accent-text"
            >
              {currentUser.profilePictureUrl ? "Edit Photo" : "Add Photo"}
            </button>
            <h2 className="text-title-2 mt-4 flex items-center justify-center gap-1.5 text-text">
              <span className="min-w-0 truncate">{getUserDisplayName(currentUser)}</span>
              <span className="mt-0.5 shrink-0">
                <VerifiedTick size={24} />
              </span>
            </h2>
            <p className="text-callout mt-1 text-text-3">{currentUser.userType}</p>
          </div>

          <p className="text-eyebrow mb-2 ml-4 text-text-3">Personal Information</p>
          <div className="card overflow-hidden p-0 [&>*+*]:border-t [&>*+*]:border-separator">
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
