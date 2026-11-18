"use client";

import { useSyncExternalStore } from "react";

import type { UserNotification } from "@/lib/api/types";

/* ------------------------------------------------------------ socket status */

export type NotificationSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

let socketStatus: NotificationSocketStatus = "idle";
const statusListeners = new Set<() => void>();

export const getNotificationSocketStatus = () => socketStatus;

export const setNotificationSocketStatus = (
  nextStatus: NotificationSocketStatus,
) => {
  if (socketStatus === nextStatus) {
    return;
  }

  socketStatus = nextStatus;
  statusListeners.forEach((listener) => listener());
};

const subscribeToStatus = (listener: () => void) => {
  statusListeners.add(listener);

  return () => {
    statusListeners.delete(listener);
  };
};

/** True while the notifications WebSocket is connected and subscribed. */
export const useIsNotificationSocketLive = () =>
  useSyncExternalStore(
    subscribeToStatus,
    () => socketStatus === "connected",
    () => false,
  );

/* ----------------------------------------------------- live delivery buffer */

/**
 * Notifications pushed over the socket are kept here briefly. A list fetch
 * that was already in flight when one arrived can come back without it (the
 * server answered first), which would make the new row flicker away. The
 * first page merges these back in until the server's list includes them.
 */
const LIVE_MEMORY_MS = 2 * 60_000;
const liveNotifications = new Map<
  string,
  { notification: UserNotification; receivedAt: number }
>();

const pruneLiveNotifications = (now = Date.now()) => {
  liveNotifications.forEach((entry, id) => {
    if (now - entry.receivedAt > LIVE_MEMORY_MS) {
      liveNotifications.delete(id);
    }
  });
};

export const rememberLiveNotification = (notification: UserNotification) => {
  pruneLiveNotifications();
  liveNotifications.set(notification.id, {
    notification,
    receivedAt: Date.now(),
  });
};

/** Keeps the buffered copy in step with local read changes. */
export const markLiveNotificationsRead = (notificationId?: string) => {
  liveNotifications.forEach((entry) => {
    if (!notificationId || entry.notification.id === notificationId) {
      entry.notification = { ...entry.notification, isRead: true };
    }
  });
};

/**
 * Returns the first page's rows with any socket-delivered notifications the
 * server did not include yet, newest first. Ones the server now returns are
 * dropped from the buffer.
 */
export const mergeLiveNotifications = (
  serverContent: UserNotification[],
): { content: UserNotification[]; added: number } => {
  pruneLiveNotifications();

  if (liveNotifications.size === 0) {
    return { content: serverContent, added: 0 };
  }

  const serverIds = new Set(serverContent.map((notification) => notification.id));
  const missing: UserNotification[] = [];

  liveNotifications.forEach((entry, id) => {
    if (serverIds.has(id)) {
      liveNotifications.delete(id);
    } else {
      missing.push(entry.notification);
    }
  });

  if (missing.length === 0) {
    return { content: serverContent, added: 0 };
  }

  missing.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return { content: [...missing, ...serverContent], added: missing.length };
};

export const clearLiveNotifications = () => {
  liveNotifications.clear();
};
