"use client";

import { useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { NetworkStatusProvider } from "./NetworkStatusProvider";
import { PasswordResetProvider } from "./PasswordResetProvider";
import { SessionTokenSync } from "./SessionTokenSync";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerRegistrar } from "@/components/system/ServiceWorkerRegistrar";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        networkMode: "always",
      },
      queries: {
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
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </SessionProvider>
  );
};
