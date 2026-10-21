"use client";

import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import { getUserInitials } from "@/lib/utils/userProfile";
import { Avatar } from "./Avatar";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";

export const DashboardHeader = ({ title }: { title: string }) => {
  const currentUserQuery = useCurrentUser();
  const initials = getUserInitials(currentUserQuery.data?.data);

  return (
    <header className="safe-top px-5">
      <div className="flex items-end justify-between pt-4 pb-4">
        <h1 className="text-large-title text-text">{title}</h1>
        <div className="flex items-center gap-3">
          <NotificationBellButton />
          <Avatar initials={initials} href="/profile" />
        </div>
      </div>
    </header>
  );
};
