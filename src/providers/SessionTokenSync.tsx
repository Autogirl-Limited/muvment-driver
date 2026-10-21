"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

import {
  setAccessToken,
  setRefreshHandler,
  setUnauthorizedHandler,
} from "@/lib/api/client";

/**
 * Bridges the NextAuth session into the plain fetch client:
 * - keeps the current access token available synchronously,
 * - on a 401 asks NextAuth to refresh (jwt callback hits /auth/refresh-token),
 * - signs the driver out when refreshing is no longer possible.
 */
export const SessionTokenSync = () => {
  const { data: session, status, update } = useSession();
  const queryClient = useQueryClient();
  const accessToken = session?.accessToken;
  const sessionError = session?.error;

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    setRefreshHandler(async () => {
      const updated = await update({ refresh: true });

      if (!updated || updated.error || !updated.accessToken) {
        return undefined;
      }

      return updated.accessToken;
    });

    setUnauthorizedHandler(() => {
      queryClient.clear();
      void signOut({ callbackUrl: "/login" });
    });

    return () => {
      setRefreshHandler(undefined);
      setUnauthorizedHandler(undefined);
    };
  }, [queryClient, update]);

  useEffect(() => {
    if (status === "authenticated" && sessionError === "RefreshFailed") {
      queryClient.clear();
      void signOut({ callbackUrl: "/login" });
    }
  }, [queryClient, sessionError, status]);

  return null;
};
