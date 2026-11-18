"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { NotificationSocketBridge } from "@/components/notifications/NotificationSocketBridge";
import { InstallSheet } from "@/components/system/InstallSheet";
import { PushRegistration } from "@/components/system/PushRegistration";
import { RideActionQueueSync } from "@/components/system/RideActionQueueSync";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import { resumeTripTrackingIfNeeded } from "@/lib/tracking/tripLocationTracker";
import { InstallPromptProvider } from "@/providers/InstallPromptProvider";

/**
 * Wraps every signed-in screen: live notification socket, resuming location
 * sharing for a trip that was active when the tab was last closed, and the
 * "install this app" prompt for drivers still using the browser tab. Also
 * sends ride actions saved offline and registers the phone for push.
 */
const subscribeNever = () => () => undefined;

/** False while the server renders and while React hydrates, true once the page is live on the client. */
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

export const AppShell = ({ children }: { children: ReactNode }) => {
  // Screens show data saved on this phone, which the server can't know. Drawing
  // them only once hydrated keeps the server's HTML and the client's identical.
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const currentUserQuery = useCurrentUser({ refetchOnMount: "always" });
  const currentUser = currentUserQuery.data?.data;
  // The saved copy of the profile can be days old (offline cache), so only a
  // profile loaded just now can send the driver to add a photo.
  // (Restoring the saved copy keeps its old timestamp, so it never counts as fresh.)
  const [mountedAt] = useState(() => Date.now());
  const isProfileFresh = currentUserQuery.dataUpdatedAt >= mountedAt;
  // A profile photo is required: the daily selfie is checked against it.
  const needsProfilePhoto =
    Boolean(currentUser) && isProfileFresh && !currentUser?.profilePictureUrl?.trim() && pathname !== "/profile-photo";

  useEffect(() => {
    void resumeTripTrackingIfNeeded();
  }, []);

  useEffect(() => {
    if (needsProfilePhoto) router.replace("/profile-photo?required=1");
  }, [needsProfilePhoto, router]);

  return (
    <InstallPromptProvider>
      <div className="mx-auto w-full max-w-lg">
        <NotificationSocketBridge />
        <RideActionQueueSync />
        <PushRegistration />
        {hydrated && !needsProfilePhoto ? children : null}
        <InstallSheet />
      </div>
    </InstallPromptProvider>
  );
};
