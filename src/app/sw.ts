import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

/* ------------------------------------------------------------------ Web Push
   Payload (JSON): {title, body, url, tag, notificationId}. `url` is an app
   path such as /trip/{id} or /payments/requests/{id}.
--------------------------------------------------------------------------- */
type DriverPushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  notificationId?: string;
};

const readPushPayload = (event: PushEvent): DriverPushPayload => {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json() as DriverPushPayload;
  } catch {
    return { body: event.data.text() };
  }
};

const FALLBACK_PATH = "/notifications";

const toAppUrl = (url?: string) => {
  try {
    const resolved = new URL(url || FALLBACK_PATH, self.location.origin);
    // Only ever open pages of this app.
    return resolved.origin === self.location.origin ? resolved.href : new URL(FALLBACK_PATH, self.location.origin).href;
  } catch {
    return new URL(FALLBACK_PATH, self.location.origin).href;
  }
};

self.addEventListener("push", (event: PushEvent) => {
  const payload = readPushPayload(event);
  const title = payload.title?.trim() || "Muvment Driver";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      tag: payload.tag || payload.notificationId || undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: toAppUrl(payload.url), notificationId: payload.notificationId ?? null },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = toAppUrl((event.notification.data as { url?: string } | null)?.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const appWindow = windows.find((client) => new URL(client.url).origin === self.location.origin);

      if (appWindow) {
        const focused = await appWindow.focus();
        await focused.navigate(targetUrl).catch(() => undefined);
        return;
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
