import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

/**
 * Keeps the app's last loaded data on the phone (IndexedDB), so every screen
 * still shows what the driver last saw when they open the app with no signal.
 * TanStack Query's cache is saved after it changes (throttled) and restored
 * before the first fetch; back online, screens refresh as usual.
 *
 * The cache is per signed-in driver: it is wiped on sign-out.
 */
const CACHE_KEY = "muvment-driver:query-cache";

/** Saved data older than this isn't shown: a week-old schedule helps nobody. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * An update may change data shapes, so a new app version starts fresh.
 * Set NEXT_PUBLIC_APP_VERSION (or let the build id do it) when shipping.
 */
const CACHE_BUSTER = process.env.NEXT_PUBLIC_APP_VERSION ?? "1";

const hasIndexedDb = () => typeof indexedDB !== "undefined";

// IndexedDB can be missing (private mode, old WebViews) or throw: degrade to "no cache".
const storage = {
  getItem: async (key: string) => {
    if (!hasIndexedDb()) return null;
    try {
      return (await get<string>(key)) ?? null;
    } catch {
      return null;
    }
  },
  removeItem: async (key: string) => {
    if (!hasIndexedDb()) return;
    try {
      await del(key);
    } catch {
      /* nothing to forget */
    }
  },
  setItem: async (key: string, value: string) => {
    if (!hasIndexedDb()) return;
    try {
      await set(key, value);
    } catch {
      /* out of quota or blocked: the app simply works online-only */
    }
  },
};

const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage,
  throttleTime: 1500,
});

/** Query keys not worth keeping, or not wanted on disk. */
const NEVER_PERSIST = new Set<string>(["push-subscription", "driver-bank-account-resolve"]);

const shouldPersist = (query: Query) =>
  query.state.status === "success" &&
  query.meta?.persist !== false &&
  !NEVER_PERSIST.has(String(query.queryKey[0]));

export const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
  buster: CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
  maxAge: PERSIST_MAX_AGE_MS,
  persister,
};

/** Forgets everything saved and in memory (sign-out: the next driver on this phone must not see it). */
export const clearOfflineCache = async (queryClient: QueryClient) => {
  queryClient.clear();
  await persister.removeClient();
};

/** When the shown data was last fetched from the server: the newest successful load in the cache. */
export const getLastSavedAt = (queryClient: QueryClient): number | undefined => {
  let newest = 0;

  queryClient
    .getQueryCache()
    .getAll()
    .forEach((query) => {
      if (query.state.status === "success" && query.state.dataUpdatedAt > newest) {
        newest = query.state.dataUpdatedAt;
      }
    });

  return newest > 0 ? newest : undefined;
};
