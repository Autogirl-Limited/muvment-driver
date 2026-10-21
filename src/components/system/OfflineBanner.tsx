"use client";

import { WifiOff } from "lucide-react";

import { useNetworkStatus } from "@/providers/NetworkStatusProvider";

export const OfflineBanner = () => {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      className="anim-rise-in pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4"
      style={{ bottom: "calc(var(--tab-bar-height) + var(--safe-bottom) + 12px)" }}
    >
      <div className="glass flex items-center gap-2 rounded-full px-4 py-2 shadow-float">
        <WifiOff size={15} className="text-danger" />
        <span className="text-footnote font-medium text-text">You&apos;re offline</span>
      </div>
    </div>
  );
};
