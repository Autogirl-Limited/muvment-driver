"use client";

import { AlertCircle, AlertTriangle, Bell, CheckCircle2 } from "lucide-react";

import type { NotificationIconName } from "@/lib/utils/notificationDisplay";

const ICONS: Record<NotificationIconName, typeof Bell> = {
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  "check-circle": CheckCircle2,
  bell: Bell,
};

export const NotificationIcon = ({ name, size = 18 }: { name: NotificationIconName; size?: number }) => {
  const Icon = ICONS[name] ?? Bell;

  return <Icon size={size} />;
};

interface NotificationCardProps {
  iconName: NotificationIconName;
  title: string;
  description: string;
  timestamp: string;
  isRead?: boolean;
  onClick?: () => void;
}

export const NotificationCard = ({
  iconName,
  title,
  description,
  timestamp,
  isRead = false,
  onClick,
}: NotificationCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`card pressable mb-3 flex w-full overflow-hidden text-left ${
      isRead ? "" : "border-accent/40"
    }`}
  >
    <span className={`w-1.5 shrink-0 ${isRead ? "bg-border-strong" : "bg-accent"}`} />
    <span className="flex flex-1 items-start gap-3 p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isRead ? "bg-surface-alt text-text-3" : "bg-accent-soft text-accent"
        }`}
      >
        <NotificationIcon name={iconName} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {!isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
          <span className={`text-body block ${isRead ? "font-medium text-text-2" : "font-semibold text-text"}`}>
            {title}
          </span>
        </span>
        <span className="text-callout mt-1 block text-text-2">{description}</span>
        <span className="text-caption mt-2 block text-text-4">{timestamp}</span>
      </span>
    </span>
  </button>
);
