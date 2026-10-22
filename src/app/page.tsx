"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Start URL. The middleware normally redirects this on the server; this
 * client fallback only runs if that is bypassed (e.g. an offline cache hit).
 * It renders a blank themed background so the OS launch screen is the only
 * splash the driver sees.
 */
export default function StartPage() {
  const router = useRouter();
  const { status, data } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    const isAuthenticated = status === "authenticated" && Boolean(data?.accessToken) && !data?.error;
    router.replace(isAuthenticated ? "/home" : "/login");
  }, [data?.accessToken, data?.error, router, status]);

  return <main className="min-h-dvh bg-bg" aria-busy="true" />;
}
