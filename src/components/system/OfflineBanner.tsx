"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, WifiOff } from "lucide-react";

import { getLastSavedAt } from "@/lib/offline/queryPersistence";
import { useNetworkStatus } from "@/providers/NetworkStatusProvider";

const BACK_ONLINE_MS = 2500;

const formatSavedAt = (timestamp?: number) => {
  if (!timestamp) return undefined;

  const date = new Date(timestamp);
  const time = date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}, ${time}`;
};

/**
 * "You're Offline · Showing what was saved at …", turning green ("Back
 * Online") for a moment on reconnect. Saved data is the TanStack Query cache
 * restored from IndexedDB (see lib/offline/queryPersistence).
 */
export const OfflineBanner = () => {
  const { isOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);
  const [backOnline, setBackOnline] = useState(false);
  const [savedAt, setSavedAt] = useState<number | undefined>();

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
      setBackOnline(false);
      setSavedAt(getLastSavedAt(queryClient));
      return;
    }

    if (!wasOffline.current) return;

    wasOffline.current = false;
    setBackOnline(true);
    const timer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);

    return () => clearTimeout(timer);
  }, [isOffline, queryClient]);

  if (!isOffline && !backOnline) {
    return null;
  }

  const saved = formatSavedAt(savedAt);

  return (
    <div
      role="status"
      aria-live="polite"
      className="anim-rise-in pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4"
      style={{ bottom: "calc(var(--tab-bar-height) + var(--safe-bottom) + 12px)" }}
    >
      <div className="glass flex max-w-full items-center gap-2 rounded-full px-4 py-2 shadow-float">
        {isOffline ? (
          <>
            <WifiOff size={15} className="shrink-0 text-danger" />
            <span className="text-footnote truncate font-medium text-text">
              You&apos;re Offline{saved ? ` · Showing what was saved at ${saved}` : ""}
            </span>
          </>
        ) : (
          <>
            <Check size={15} className="shrink-0 text-success" />
            <span className="text-footnote font-medium text-success-text">Back Online</span>
          </>
        )}
      </div>
    </div>
  );
};
