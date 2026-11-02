/**
 * Web Push (VAPID) registration for driver notifications.
 *
 * After login, when notification permission is granted, the app subscribes
 * through the service worker and sends the subscription to the backend
 * (POST /driver-app/devices/push-token, upserted by endpoint). On logout or
 * when the driver turns push off in Settings, the subscription is removed
 * (DELETE with the endpoint) and unsubscribed locally.
 */
import { apiFetchClient } from "../api/client";
import type { PushConfigResponse, RegisterPushTokenPayload } from "../api/types";
import { storage } from "../utils/storage";

export const PUSH_CONFIG_PATH = "/driver-app/devices/push-config";
export const PUSH_TOKEN_PATH = "/driver-app/devices/push-token";

const REGISTERED_ENDPOINT_KEY = "push-endpoint";
const SW_READY_TIMEOUT_MS = 8000;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "pwa";

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  typeof Notification !== "undefined";

const urlBase64ToUint8Array = (base64: string) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
};

const toBase64Url = (buffer: ArrayBuffer | null) => {
  if (!buffer) {
    return "";
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** The active registration, or undefined when no service worker is installed (e.g. `next dev`). */
const getRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (!isPushSupported()) {
    return undefined;
  }

  const existing = await navigator.serviceWorker.getRegistration().catch(() => undefined);

  if (!existing) {
    return undefined;
  }

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), SW_READY_TIMEOUT_MS)),
  ]);
};

const sameKey = (subscription: PushSubscription, publicKey: Uint8Array) => {
  const current = subscription.options?.applicationServerKey;

  if (!current) {
    return true;
  }

  const currentBytes = new Uint8Array(current);

  return currentBytes.length === publicKey.length && currentBytes.every((byte, index) => byte === publicKey[index]);
};

/**
 * Subscribes (or re-uses the existing subscription) and registers it with the
 * backend. Never prompts: callers ask for permission first. Returns whether a
 * subscription is now registered.
 */
export const ensurePushSubscription = async (): Promise<boolean> => {
  if (!isPushSupported() || Notification.permission !== "granted") {
    return false;
  }

  const registration = await getRegistration();

  if (!registration) {
    return false;
  }

  const configResponse = await apiFetchClient.get<PushConfigResponse>(PUSH_CONFIG_PATH);
  const config = configResponse.data.data;

  if (!config?.enabled || !config.publicKey) {
    return false;
  }

  const applicationServerKey = urlBase64ToUint8Array(config.publicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !sameKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  }

  const payload: RegisterPushTokenPayload = {
    endpoint: subscription.endpoint,
    keys: { p256dh: toBase64Url(subscription.getKey("p256dh")), auth: toBase64Url(subscription.getKey("auth")) },
    platform: "WEB",
    appVersion: APP_VERSION,
    userAgent: navigator.userAgent.slice(0, 255),
  };

  await apiFetchClient.post(PUSH_TOKEN_PATH, payload);
  storage.set(REGISTERED_ENDPOINT_KEY, subscription.endpoint);

  return true;
};

/**
 * Removes this device's subscription from the backend (best effort) and
 * unsubscribes it. `notifyServer: false` skips the API call, e.g. when the
 * session has already expired.
 */
export const removePushSubscription = async ({ notifyServer = true }: { notifyServer?: boolean } = {}) => {
  const registration = await getRegistration().catch(() => undefined);
  const subscription = await registration?.pushManager.getSubscription().catch(() => null);
  const endpoint = subscription?.endpoint ?? storage.get(REGISTERED_ENDPOINT_KEY) ?? undefined;

  if (notifyServer && endpoint) {
    await apiFetchClient
      .request(PUSH_TOKEN_PATH, { method: "DELETE", body: { endpoint } })
      .catch(() => undefined);
  }

  await subscription?.unsubscribe().catch(() => undefined);
  storage.remove(REGISTERED_ENDPOINT_KEY);
};
