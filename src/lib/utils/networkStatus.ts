import { onlineManager } from "@tanstack/react-query";

export const OFFLINE_ERROR_CODE = "ERR_OFFLINE";
export const OFFLINE_ERROR_MESSAGE =
  "You're offline. Check your internet connection and try again.";

/** TanStack's onlineManager already listens to the browser's online/offline events. */
export const isAppKnownOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false
    ? true
    : onlineManager.isOnline() === false;
