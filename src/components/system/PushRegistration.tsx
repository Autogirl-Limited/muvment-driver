"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import { useDriverNotificationSettings } from "@/lib/api/hooks/useDriverSettings";
import { ensurePushSubscription, isPushSupported } from "@/lib/push/webPush";

/**
 * Registers this phone for push after login, when the browser already has
 * notification permission and the driver hasn't turned push off in Settings.
 * It never prompts; the Settings toggle asks for permission.
 */
export const PushRegistration = () => {
  const { status } = useSession();
  const settingsQuery = useDriverNotificationSettings();
  const sendNotification = settingsQuery.data?.data.sendNotification;
  const registeredRef = useRef(false);

  useEffect(() => {
    if (
      registeredRef.current ||
      status !== "authenticated" ||
      sendNotification !== true ||
      !isPushSupported() ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    registeredRef.current = true;
    ensurePushSubscription().catch(() => {
      // Try again on the next app start.
      registeredRef.current = false;
    });
  }, [sendNotification, status]);

  return null;
};
