"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";

const ALLOW_DESKTOP = process.env.NEXT_PUBLIC_ALLOW_DESKTOP === "true";
const DESKTOP_MIN_WIDTH = 820;

const isDesktopBrowser = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const touch = navigator.maxTouchPoints > 0;
  const wide = window.innerWidth >= DESKTOP_MIN_WIDTH;

  return wide && !coarsePointer && !touch;
};

/**
 * Muvment Driver is a phone app. On a desktop browser we show a hand-off
 * screen with a QR code to the same URL instead of a stretched layout.
 */
export const MobileOnlyGate = ({ children }: { children: ReactNode }) => {
  const [blocked, setBlocked] = useState(false);
  const [href, setHref] = useState("");

  useEffect(() => {
    if (ALLOW_DESKTOP) {
      return;
    }

    const evaluate = () => {
      setBlocked(isDesktopBrowser());
      setHref(window.location.href);
    };

    evaluate();
    window.addEventListener("resize", evaluate);

    return () => window.removeEventListener("resize", evaluate);
  }, []);

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-6">
      <div className="card anim-scale-in w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Smartphone size={28} />
        </div>
        <h1 className="text-title-2 text-text">Open on your phone</h1>
        <p className="text-callout mt-2 text-text-2">
          Muvment Driver is built for phones: camera, GPS and one-handed use. Scan this code to
          continue on your mobile device.
        </p>
        {href && (
          <div className="mx-auto mt-6 w-fit rounded-2xl bg-white p-3">
            <QRCodeSVG value={href} size={176} level="M" />
          </div>
        )}
        <p className="text-caption mt-5 break-all text-text-4">{href}</p>
      </div>
    </div>
  );
};
