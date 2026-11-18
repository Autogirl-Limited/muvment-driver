"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { NotificationCard } from "@/components/notifications/NotificationCard";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { Spinner } from "@/components/ui/Spinner";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUserNotifications,
} from "@/lib/api/hooks/useNotifications";
import type { UserNotification } from "@/lib/api/types";
import {
  formatRelativeTime,
  notificationGroup,
  notificationLook,
  type NotificationGroup,
} from "@/lib/utils/notificationLook";
import { useToast } from "@/providers/ToastProvider";

interface NotificationSection {
  title: NotificationGroup;
  data: UserNotification[];
}

const GROUP_ORDER: NotificationGroup[] = ["Today", "Yesterday", "Earlier"];

const groupNotifications = (notifications: UserNotification[]): NotificationSection[] => {
  const now = new Date();
  const groups: Record<NotificationGroup, UserNotification[]> = { Today: [], Yesterday: [], Earlier: [] };

  notifications.forEach((notification) => {
    groups[notificationGroup(notification.createdAt, now)].push(notification);
  });

  return GROUP_ORDER.filter((title) => groups[title].length > 0).map((title) => ({ data: groups[title], title }));
};

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
  const notificationsQuery = useUserNotifications();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(
    () => notificationsQuery.data?.pages.flatMap((page) => page.data.content) ?? [],
    [notificationsQuery.data],
  );
  const sections = useMemo(() => groupNotifications(notifications), [notifications]);
  const hasUnread = notifications.some((notification) => !notification.isRead);
  const errorMessage = getApiErrorMessage(notificationsQuery.error);
  const isInitialLoading = notificationsQuery.isLoading && sections.length === 0;

  useEffect(() => {
    void notificationsQuery.refetch();
    // Refresh on open, like the native focus effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
        void notificationsQuery.fetchNextPage();
      }
    });

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [notificationsQuery]);

  // Opening a notification marks it read in the background: the list shows it
  // read at once (see useMarkNotificationRead) and you land on the message
  // without waiting for the server.
  const handleOpen = (notification: UserNotification) => {
    if (!notification.isRead) {
      markNotificationRead.mutate(notification.id, {
        onError: (error) =>
          toast.error("Unable to update notification", getApiErrorMessage(error) ?? "Please try again."),
      });
    }

    router.push(`/notification/${encodeURIComponent(notification.id)}`);
  };

  const handleMarkAll = async () => {
    if (!hasUnread || markAllNotificationsRead.isPending) {
      return;
    }

    try {
      const response = await markAllNotificationsRead.mutateAsync();
      toast.success(response.message || "All notifications marked as read");
    } catch (error) {
      toast.error("Unable to mark all as read", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  return (
    <Screen>
      <NavBar
        left={<BackButton />}
        right={
          notifications.length > 0 ? (
            <button
              type="button"
              disabled={!hasUnread || markAllNotificationsRead.isPending}
              onClick={() => void handleMarkAll()}
              className={`pressable inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                hasUnread ? "border-accent text-accent" : "border-border text-text-4"
              }`}
            >
              <CheckCheck size={14} />
              Mark all
            </button>
          ) : null
        }
        largeTitle="Notifications"
      />

      {isInitialLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center pb-20 text-accent">
          <Spinner size={26} />
          <p className="text-callout mt-3 text-text-3">Loading notifications</p>
        </div>
      ) : notificationsQuery.isError && sections.length === 0 ? (
        <EmptyState
          title="Unable to load notifications"
          description={errorMessage ?? "Please check your connection and try again."}
        />
      ) : sections.length > 0 ? (
        <div className="px-5 pb-6">
          {sections.map((section) => (
            <section key={section.title} className="mb-5">
              <p className="text-eyebrow mb-2 ml-1 text-text-3">{section.title}</p>
              <div className="card overflow-hidden">
                {section.data.map((item) => (
                  <NotificationCard
                    key={item.id}
                    look={notificationLook(item)}
                    title={item.title}
                    description={item.message}
                    timestamp={formatRelativeTime(item.createdAt)}
                    isRead={item.isRead}
                    onClick={() => handleOpen(item)}
                  />
                ))}
              </div>
            </section>
          ))}
          <div ref={sentinelRef} className="flex justify-center py-4 text-accent">
            {notificationsQuery.isFetchingNextPage && <Spinner size={20} />}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No notifications yet"
          description="When you receive trip updates, reminders, or alerts, they'll appear here."
        />
      )}
    </Screen>
  );
}
