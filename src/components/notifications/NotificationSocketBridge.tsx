"use client";

import { useEffect, useMemo } from "react";
import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useQueryClient } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/api/client";
import { USER_NOTIFICATIONS_QUERY_KEY, upsertLoadedNotification } from "@/lib/api/hooks/useNotifications";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { NotificationPriority, NotificationType, UserNotification } from "@/lib/api/types";
import { useToast } from "@/providers/ToastProvider";

const NOTIFICATION_TYPES: NotificationType[] = ["INFO", "WARNING", "ERROR", "SUCCESS"];
const NOTIFICATION_PRIORITIES: NotificationPriority[] = ["LOW", "MEDIUM", "HIGH"];
const IS_DEV = process.env.NODE_ENV === "development";

const getSockJsUrl = (rawUrl: string | undefined) => {
  const trimmedUrl = rawUrl?.trim();

  if (!trimmedUrl) {
    return undefined;
  }
  if (trimmedUrl.startsWith("wss://")) {
    return `https://${trimmedUrl.slice("wss://".length)}`;
  }
  if (trimmedUrl.startsWith("ws://")) {
    return `http://${trimmedUrl.slice("ws://".length)}`;
  }

  return trimmedUrl;
};

const deriveSockJsUrlFromApiBase = () => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!apiBaseUrl) {
    return undefined;
  }

  try {
    const apiUrl = new URL(apiBaseUrl);
    apiUrl.pathname = "/ws";
    apiUrl.search = "";
    apiUrl.hash = "";

    return getSockJsUrl(apiUrl.toString().replace(/\/$/, ""));
  } catch {
    return undefined;
  }
};

const WS_URL = getSockJsUrl(process.env.NEXT_PUBLIC_WS_URL) ?? deriveSockJsUrlFromApiBase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (source: Record<string, unknown>, key: string): string | undefined => {
  const value = source[key];

  return typeof value === "string" && value.trim() ? value : undefined;
};

const getNullableString = (source: Record<string, unknown>, key: string): string | null | undefined =>
  source[key] === null ? null : getString(source, key);

const getBoolean = (source: Record<string, unknown>, key: string, fallback: boolean) =>
  typeof source[key] === "boolean" ? (source[key] as boolean) : fallback;

const normalizeNotification = (payload: unknown): UserNotification | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }

  const id = getString(payload, "id");
  const title = getString(payload, "title");
  const message = getString(payload, "message");

  if (!id || !title || !message) {
    return undefined;
  }

  const createdAtRaw = payload.createdAt;
  const createdAt =
    typeof createdAtRaw === "string" && !Number.isNaN(new Date(createdAtRaw).getTime())
      ? createdAtRaw
      : new Date().toISOString();

  return {
    actionUrl: getNullableString(payload, "actionUrl") ?? null,
    createdAt,
    entityId: getNullableString(payload, "entityId") ?? null,
    entityName: getNullableString(payload, "entityName") ?? null,
    id,
    isDeleted: getBoolean(payload, "isDeleted", false),
    isRead: getBoolean(payload, "isRead", false),
    message,
    priority: NOTIFICATION_PRIORITIES.includes(payload.priority as NotificationPriority)
      ? (payload.priority as NotificationPriority)
      : "LOW",
    title,
    type: NOTIFICATION_TYPES.includes(payload.type as NotificationType)
      ? (payload.type as NotificationType)
      : "INFO",
    updatedAt: getNullableString(payload, "updatedAt") ?? null,
  };
};

const parseSocketMessage = (message: IMessage): UserNotification | undefined => {
  try {
    return normalizeNotification(JSON.parse(message.body));
  } catch {
    return undefined;
  }
};

/** Subscribes to the per-user STOMP queue and surfaces new notifications as banners. */
export function NotificationSocketBridge() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUserQuery = useCurrentUser();
  const userId = currentUserQuery.data?.data.userId;
  const subscriptionDestination = useMemo(
    () => (userId ? `/user/${userId}/queue/notifications` : undefined),
    [userId],
  );

  useEffect(() => {
    if (!WS_URL || !subscriptionDestination) {
      return;
    }

    let subscription: StompSubscription | undefined;
    let isActive = true;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => undefined,
      beforeConnect: () => {
        const accessToken = getAccessToken();

        if (!accessToken) {
          void client.deactivate();
          return;
        }

        client.connectHeaders = { Authorization: `Bearer ${accessToken}` };
      },
      onConnect: () => {
        if (!isActive) {
          return;
        }

        subscription = client.subscribe(subscriptionDestination, (message) => {
          const notification = parseSocketMessage(message);

          if (!notification) {
            return;
          }

          upsertLoadedNotification(queryClient, notification);
          toast.show({
            type: notification.type === "ERROR" || notification.priority === "HIGH" ? "error" : "success",
            title: notification.title,
            message: notification.message,
          });
          void queryClient.invalidateQueries({ queryKey: USER_NOTIFICATIONS_QUERY_KEY });
        });
      },
      onStompError: (frame) => {
        if (IS_DEV) {
          console.warn("[notifications:socket] STOMP error", frame.headers.message);
        }
      },
    });

    client.activate();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: USER_NOTIFICATIONS_QUERY_KEY });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      subscription?.unsubscribe();
      void client.deactivate();
    };
  }, [queryClient, subscriptionDestination, toast]);

  return null;
}
