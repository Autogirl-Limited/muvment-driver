import {
  AlertTriangle,
  Banknote,
  Bell,
  CalendarDays,
  Car,
  CheckCircle2,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { UserNotification } from "../api/types";
import { parseNotificationDate } from "./notificationDisplay";

/** iOS system colours, as used for app icons in Notification Center. */
const IOS = {
  blue: "#0A84FF",
  green: "#34C759",
  gray: "#8E8E93",
  indigo: "#5E5CE6",
  orange: "#FF9500",
  red: "#FF3B30",
};

export interface NotificationLook {
  icon: LucideIcon;
  tint: string;
}

/**
 * The rounded-square "app icon" a notification shows, picked from what it's
 * about (trip, payment, schedule…) and falling back to its type.
 */
export const notificationLook = (
  notification: Pick<UserNotification, "entityName" | "message" | "priority" | "title" | "type">,
): NotificationLook => {
  if (notification.type === "ERROR") return { icon: XCircle, tint: IOS.red };
  if (notification.type === "WARNING" || notification.priority === "HIGH") {
    return { icon: AlertTriangle, tint: IOS.orange };
  }

  const about = `${notification.entityName ?? ""} ${notification.title} ${notification.message}`.toLowerCase();

  if (/\b(pay|payment|payout|paid|invoice|earning|wallet|bank)/.test(about)) return { icon: Banknote, tint: IOS.green };
  if (/\b(schedule|shift|calendar|roster)/.test(about)) return { icon: CalendarDays, tint: IOS.red };
  if (/\b(checklist|inspection|maintenance|repair)/.test(about)) return { icon: Wrench, tint: IOS.gray };
  if (/\b(trip|ride|booking|pickup|drop.?off|passenger|vehicle)/.test(about)) return { icon: Car, tint: IOS.indigo };
  if (notification.type === "SUCCESS") return { icon: CheckCircle2, tint: IOS.green };

  return { icon: Bell, tint: IOS.blue };
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Notification Center's short time: "now", "5m ago", "2h ago", "Yesterday", "Mon", "2 Nov". */
export const formatRelativeTime = (value: string, now = new Date()) => {
  const date = parseNotificationDate(value);

  if (!date) return "";

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (sameDay(date, now)) return `${Math.floor(minutes / 60)}h ago`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(date, yesterday)) return "Yesterday";
  if (minutes < 7 * 24 * 60) return date.toLocaleDateString("en-US", { weekday: "short" });

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export type NotificationGroup = "Today" | "Yesterday" | "Earlier";

export const notificationGroup = (value: string, now = new Date()): NotificationGroup => {
  const date = parseNotificationDate(value);

  if (!date) return "Earlier";
  if (sameDay(date, now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  return sameDay(date, yesterday) ? "Yesterday" : "Earlier";
};
