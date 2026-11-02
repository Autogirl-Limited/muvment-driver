"use client";

import { useEffect, type ReactNode } from "react";

import { NotificationSocketBridge } from "@/components/notifications/NotificationSocketBridge";
import { InstallSheet } from "@/components/system/InstallSheet";
import { PushRegistration } from "@/components/system/PushRegistration";
import { RideActionQueueSync } from "@/components/system/RideActionQueueSync";
import { resumeTripTrackingIfNeeded } from "@/lib/tracking/tripLocationTracker";
import { InstallPromptProvider } from "@/providers/InstallPromptProvider";

/**
 * Wraps every signed-in screen: live notification socket, resuming location
 * sharing for a trip that was active when the tab was last closed, and the
 * "install this app" prompt for drivers still using the browser tab. Also
 * sends ride actions saved offline and registers the phone for push.
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void resumeTripTrackingIfNeeded();
  }, []);

  return (
    <InstallPromptProvider>
      <div className="mx-auto w-full max-w-lg">
        <NotificationSocketBridge />
        <RideActionQueueSync />
        <PushRegistration />
        {children}
        <InstallSheet />
      </div>
    </InstallPromptProvider>
  );
};
