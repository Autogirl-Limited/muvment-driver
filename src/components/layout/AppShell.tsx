"use client";

import { useEffect, type ReactNode } from "react";

import { NotificationSocketBridge } from "@/components/notifications/NotificationSocketBridge";
import { InstallSheet } from "@/components/system/InstallSheet";
import { resumeTripTrackingIfNeeded } from "@/lib/tracking/tripLocationTracker";
import { InstallPromptProvider } from "@/providers/InstallPromptProvider";

/**
 * Wraps every signed-in screen: live notification socket, resuming location
 * sharing for a trip that was active when the tab was last closed, and the
 * "install this app" prompt for drivers still using the browser tab.
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void resumeTripTrackingIfNeeded();
  }, []);

  return (
    <InstallPromptProvider>
      <div className="mx-auto w-full max-w-lg">
        <NotificationSocketBridge />
        {children}
        <InstallSheet />
      </div>
    </InstallPromptProvider>
  );
};
