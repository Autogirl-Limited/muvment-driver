"use client";

import { useEffect, type ReactNode } from "react";

import { NotificationSocketBridge } from "@/components/notifications/NotificationSocketBridge";
import { resumeTripTrackingIfNeeded } from "@/lib/tracking/tripLocationTracker";

/**
 * Wraps every signed-in screen: live notification socket and resuming
 * location sharing for a trip that was active when the tab was last closed.
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void resumeTripTrackingIfNeeded();
  }, []);

  return (
    <div className="mx-auto w-full max-w-lg">
      <NotificationSocketBridge />
      {children}
    </div>
  );
};
