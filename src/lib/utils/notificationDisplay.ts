import type {
  NotificationPriority,
  NotificationType,
  UserNotification,
} from "../api/types";

export type NotificationIconName = "alert-circle" | "alert-triangle" | "check-circle" | "bell";

export const parseNotificationDate = (value: string) => {
  const normalizedValue = value.replace(/(\.\d{3})\d+/, "$1");
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const isNotificationFromToday = (value: string) => {
  const date = parseNotificationDate(value);

  if (!date) {
    return false;
  }

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

export const formatNotificationTimestamp = (value: string) => {
  const date = parseNotificationDate(value);

  if (!date) {
    return "Time unavailable";
  }

  if (isNotificationFromToday(value)) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatNotificationDetailTimestamp = (value: string) => {
  const date = parseNotificationDate(value);

  if (!date) {
    return "Time unavailable";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const getNotificationIcon = (
  notification: Pick<UserNotification, "priority" | "type">,
): NotificationIconName => {
  if (notification.priority === "HIGH") {
    return "alert-circle";
  }

  switch (notification.type) {
    case "ERROR":
      return "alert-triangle";
    case "SUCCESS":
      return "check-circle";
    case "WARNING":
      return "alert-circle";
    case "INFO":
    default:
      return "bell";
  }
};

export const isNotificationPriority = (
  value: string | undefined,
): value is NotificationPriority =>
  value === "LOW" || value === "MEDIUM" || value === "HIGH";

export const isNotificationType = (
  value: string | undefined,
): value is NotificationType =>
  value === "INFO" ||
  value === "WARNING" ||
  value === "ERROR" ||
  value === "SUCCESS";
