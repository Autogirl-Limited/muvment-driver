"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { useUnreadNotificationsCount } from "@/lib/api/hooks/useNotifications";

export const NotificationBellButton = ({ inverse = false }: { inverse?: boolean }) => {
  const { unreadCount } = useUnreadNotificationsCount();

  return (
    <Link
      href="/notifications"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      className={`pressable relative flex h-10 w-10 items-center justify-center rounded-full ${
        inverse ? "bg-white/15 text-white" : "border border-border bg-surface text-text-2"
      }`}
    >
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-bg">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
};
