"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useScreenThemeColor } from "@/providers/ThemeProvider";

const SPLASH_COLOR = "#1D2739";

/** Splash: brand mark on navy, then hands off to Home or Login once the session is known. */
export default function SplashPage() {
  const router = useRouter();
  const { status, data } = useSession();
  useScreenThemeColor(SPLASH_COLOR);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    const isAuthenticated = status === "authenticated" && Boolean(data?.accessToken) && !data?.error;
    const timer = setTimeout(() => {
      router.replace(isAuthenticated ? "/home" : "/login");
    }, 900);

    return () => clearTimeout(timer);
  }, [data?.accessToken, data?.error, router, status]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#1D2739]">
      <div className="anim-scale-in flex flex-col items-center">
        <Image src="/brand/splash-logo.png" alt="Muvment" width={120} height={120} priority className="h-28 w-28" />
        <p className="mt-6 text-[13px] font-medium tracking-[0.18em] text-white/60 uppercase">Driver</p>
      </div>
    </main>
  );
}
