/**
 * Notification links (push `data.url`, in-app `actionUrl`) are app paths such
 * as `/trip/{id}`, `/payments/requests/{id}` or `/payments/payouts/{id}`.
 * Full URLs from the PWA are reduced to their path.
 */
const KNOWN_PREFIXES = [
  "/checklist/",
  "/post-ride-checklist/",
  "/trip/",
  "/trip-navigation/",
  "/payments",
  "/payment-account",
  "/my-schedule",
  "/notification/",
  "/Notification",
  "/home",
  "/trips",
  "/settings",
  "/checklist-history",
  "/incident-reports",
];

export const toAppPath = (url?: string | null): string | undefined => {
  const trimmed = url?.trim();

  if (!trimmed) {
    return undefined;
  }

  let path = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      return undefined;
    }
  }

  if (!path.startsWith("/")) {
    return undefined;
  }

  return KNOWN_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix)) ? path : undefined;
};

/* ------------------------------------------------------------------ toast dedupe */
const TOAST_MEMORY_MS = 10 * 60_000;
const toastedAt = new Map<string, number>();

/**
 * The same notification can arrive over the WebSocket and as a push while the
 * app is open. Returns true the first time an id is seen (show the toast),
 * false after that. Notifications without an id are always shown.
 */
export const claimNotificationToast = (id?: string | null) => {
  if (!id) {
    return true;
  }

  const now = Date.now();
  toastedAt.forEach((at, key) => {
    if (now - at > TOAST_MEMORY_MS) {
      toastedAt.delete(key);
    }
  });

  if (toastedAt.has(id)) {
    return false;
  }

  toastedAt.set(id, now);
  return true;
};
