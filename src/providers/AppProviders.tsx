"use client";

import { useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { NetworkStatusProvider } from "./NetworkStatusProvider";
import { PasswordResetProvider } from "./PasswordResetProvider";
import { SessionTokenSync } from "./SessionTokenSync";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerRegistrar } from "@/components/system/ServiceWorkerRegistrar";
import { PERSIST_MAX_AGE_MS, persistOptions } from "@/lib/offline/queryPersistence";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        networkMode: "always",
      },
      queries: {
        // Must be at least the persisted max age, or cached data is dropped before it can be saved.
        gcTime: PERSIST_MAX_AGE_MS,
        networkMode: "online",
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });

export const AppProviders = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(createQueryClient);

  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SessionTokenSync />
        <NetworkStatusProvider>
          <ThemeProvider>
            <ToastProvider>
              <PasswordResetProvider>
                {children}
                <OfflineBanner />
                <ServiceWorkerRegistrar />
              </PasswordResetProvider>
            </ToastProvider>
          </ThemeProvider>
        </NetworkStatusProvider>
      </PersistQueryClientProvider>
    </SessionProvider>
  );
};
