"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { NotificationIcon } from "@/components/notifications/NotificationCard";
import { BackButton } from "@/components/ui/BackButton";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { Spinner } from "@/components/ui/Spinner";
import {
  findLoadedNotification,
  useMarkNotificationRead,
  useUserNotifications,
} from "@/lib/api/hooks/useNotifications";
import type { UserNotification } from "@/lib/api/types";
import { formatNotificationDetailTimestamp, getNotificationIcon } from "@/lib/utils/notificationDisplay";
import { openExternalUrl } from "@/lib/utils/deviceActions";
import { useToast } from "@/providers/ToastProvider";

const PRIORITY_TONE: Record<UserNotification["priority"], "danger" | "warning" | "accent"> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "accent",
};

export default function NotificationDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const notificationId = decodeURIComponent(params.id ?? "");
  const notificationsQuery = useUserNotifications();
  const markNotificationRead = useMarkNotificationRead();
  const [hasRequestedReadUpdate, setHasRequestedReadUpdate] = useState(false);
  const notification = findLoadedNotification(notificationsQuery.data, notificationId);

  useEffect(() => {
    if (!notification || notification.isRead || hasRequestedReadUpdate || markNotificationRead.isPending) {
      return;
    }

    setHasRequestedReadUpdate(true);
    markNotificationRead.mutate(notification.id);
  }, [hasRequestedReadUpdate, markNotificationRead, notification]);

  const handleOpenAction = () => {
    const actionUrl = notification?.actionUrl?.trim();

    if (!actionUrl) {
      return;
    }

    if (actionUrl.startsWith("/")) {
      router.push(actionUrl);
      return;
    }

    if (!/^https?:\/\//i.test(actionUrl)) {
      toast.error("Link unavailable", "This notification link cannot be opened.");
      return;
    }

    openExternalUrl(actionUrl);
  };

  return (
    <Screen>
      <NavBar left={<BackButton />} largeTitle="Notification" />

      {!notification && notificationsQuery.isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center pb-20 text-accent">
          <Spinner size={26} />
          <p className="text-callout mt-3 text-text-3">Loading notification</p>
        </div>
      ) : notification ? (
        <div className="anim-rise-in px-5 pb-8">
          <article className="card p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <NotificationIcon name={getNotificationIcon(notification)} size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-title-2 text-text">{notification.title}</h2>
                <p className="text-callout mt-1 text-text-3">
                  {formatNotificationDetailTimestamp(notification.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Pill tone={PRIORITY_TONE[notification.priority]}>{notification.priority}</Pill>
              <Pill>{notification.type}</Pill>
            </div>

            <div className="my-5 h-px bg-separator" />

            <p className="text-body whitespace-pre-line text-text-2">{notification.message}</p>

            {(notification.entityName || notification.entityId) && (
              <div className="mt-6 rounded-xl border border-border bg-surface-alt p-4">
                {notification.entityName && <p className="text-callout font-medium text-text">{notification.entityName}</p>}
                {notification.entityId && (
                  <p className="text-caption mt-1 text-text-3">Reference: {notification.entityId}</p>
                )}
              </div>
            )}

            {notification.actionUrl && (
              <div className="mt-6">
                <Button size="md" icon={<ExternalLink size={18} />} onClick={handleOpenAction}>
                  Open
                </Button>
              </div>
            )}
          </article>
        </div>
      ) : (
        <EmptyState title="Notification unavailable" description="This notification could not be found." />
      )}
    </Screen>
  );
}
