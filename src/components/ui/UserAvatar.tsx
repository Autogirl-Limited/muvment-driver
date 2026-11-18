/* eslint-disable @next/next/no-img-element */
"use client";

import type { UserProfile } from "@/lib/api/types";
import { getUserInitials } from "@/lib/utils/userProfile";

/** The driver's photo, or their initials on a blue gradient while there isn't one. */
export const UserAvatar = ({ user, size = 62, className = "" }: { user?: Pick<UserProfile, "firstName" | "lastName" | "profilePictureUrl">; size?: number; className?: string }) => {
  const url = user?.profilePictureUrl?.trim();

  return url ? (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full bg-fill object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5A9EFF] to-[#0673FF] font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.39 }}
    >
      {getUserInitials(user)}
    </span>
  );
};
