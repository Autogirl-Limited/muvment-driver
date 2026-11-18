"use client";

import { Bell } from "lucide-react";

import type { NotificationLook } from "@/lib/utils/notificationLook";

/** A notification "platter": app-style tinted icon, bold title, two-line preview, unread dot. */
export const NotificationCard = ({
  look,
  title,
  description,
  timestamp,
  isRead = false,
  onClick,
}: {
  look: NotificationLook;
  title: string;
  description: string;
  timestamp: string;
  isRead?: boolean;
  onClick?: () => void;
}) => {
  const Icon = look.icon ?? Bell;

  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable-row hairline-b flex w-full items-start gap-3 px-4 py-3 text-left last:border-b-0"
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white shadow-sm"
        style={{ backgroundImage: `linear-gradient(160deg, ${look.tint}, ${look.tint}CC)` }}
      >
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`text-body min-w-0 flex-1 truncate ${isRead ? "font-medium text-text-2" : "font-semibold text-text"}`}>
            {title}
          </span>
          <span className="text-caption shrink-0 text-text-4">{timestamp}</span>
        </span>
        <span className="text-callout mt-0.5 line-clamp-2 block text-text-3">{description}</span>
      </span>
      {!isRead && <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
    </button>
  );
};
