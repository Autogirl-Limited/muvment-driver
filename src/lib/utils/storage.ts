/**
 * Small, safe wrapper around localStorage. The Expo app used SecureStore for
 * these values (theme, idempotency keys, cached trip ids); in the browser the
 * NextAuth cookie holds the sensitive tokens and localStorage holds only
 * non-secret UI state. Every call is guarded: private mode, quota errors and
 * server rendering all degrade to "no storage".
 */
const PREFIX = "muvment-driver:";

const getStorage = (): Storage | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export const storage = {
  get(key: string): string | null {
    try {
      return getStorage()?.getItem(PREFIX + key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      getStorage()?.setItem(PREFIX + key, value);
    } catch {
      // Best effort only.
    }
  },
  remove(key: string) {
    try {
      getStorage()?.removeItem(PREFIX + key);
    } catch {
      // Best effort only.
    }
  },
  getJSON<T>(key: string): T | null {
    const raw = storage.get(key);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown) {
    storage.set(key, JSON.stringify(value));
  },
};
