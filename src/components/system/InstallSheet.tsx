"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Compass,
  Download,
  MoreVertical,
  Plus,
  Share,
  Smartphone,
  SquarePlus,
  WifiOff,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import type { InstallEnvironment } from "@/lib/pwa/install";
import { useInstallPrompt } from "@/providers/InstallPromptProvider";

/* ------------------------------------------------------------------ copy */
const BENEFITS = [
  { icon: Zap, text: "Opens in one tap from your home screen, full screen like a native app" },
  { icon: WifiOff, text: "Keeps working when the network drops between trips" },
  { icon: Bell, text: "Trip alerts and live location sharing stay reliable while you drive" },
];

type Step = { icon: ReactNode; title: string; detail: string };

const IOS_SAFARI_STEPS = (isTablet: boolean): Step[] => [
  {
    icon: <Share size={18} />,
    title: "Tap the Share button",
    detail: isTablet
      ? "It is the square with an arrow at the top right of Safari, next to the address bar."
      : "It is the square with an arrow in the bar at the bottom of Safari.",
  },
  {
    icon: <SquarePlus size={18} />,
    title: "Choose “Add to Home Screen”",
    detail: "Scroll down the share sheet a little if you don't see it right away.",
  },
  {
    icon: <Plus size={18} />,
    title: "Tap “Add” at the top right",
    detail: "Muvment Driver appears on your home screen. Open it from there from now on.",
  },
];

const IOS_OTHER_BROWSER_STEPS = (browserName: string): Step[] => [
  {
    icon: <Share size={18} />,
    title: `Tap the Share button in ${browserName}`,
    detail: "It is the square with an arrow, usually next to the address bar.",
  },
  {
    icon: <SquarePlus size={18} />,
    title: "Choose “Add to Home Screen”",
    detail: "If it is missing, your iOS version needs Safari for this step (see below).",
  },
  {
    icon: <Plus size={18} />,
    title: "Tap “Add”",
    detail: "Then open Muvment Driver from your home screen.",
  },
];

const ANDROID_MANUAL_STEPS = (browser: InstallEnvironment["browser"]): Step[] => {
  const menuLabel = browser === "samsung" ? "the ☰ menu at the bottom right" : "the ⋮ menu at the top right";
  const itemLabel =
    browser === "samsung"
      ? "“Add page to” → “Home screen”"
      : browser === "firefox"
        ? "“Install” or “Add to Home screen”"
        : "“Install app” or “Add to Home screen”";

  return [
    { icon: <MoreVertical size={18} />, title: `Open ${menuLabel}`, detail: "In your browser, not in the page." },
    { icon: <Download size={18} />, title: `Tap ${itemLabel}`, detail: "Confirm when the browser asks." },
    {
      icon: <CheckCircle2 size={18} />,
      title: "Open it from your home screen",
      detail: "Look for the Muvment icon, then sign in once and you are set.",
    },
  ];
};

const browserDisplayName: Record<InstallEnvironment["browser"], string> = {
  safari: "Safari",
  chrome: "Chrome",
  samsung: "Samsung Internet",
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
  "in-app": "this app",
  other: "your browser",
};

/* ------------------------------------------------------------------ pieces */
const StepList = ({ steps }: { steps: Step[] }) => (
  <ol className="space-y-3">
    {steps.map((step, index) => (
      <li key={step.title} className="flex items-start gap-3">
        <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
          {step.icon}
          <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white ring-2 ring-bg-elevated">
            {index + 1}
          </span>
        </span>
        <span className="min-w-0">
          <span className="text-body block font-semibold text-text">{step.title}</span>
          <span className="text-footnote block text-text-2">{step.detail}</span>
        </span>
      </li>
    ))}
  </ol>
);

const Benefits = () => (
  <ul className="mb-5 space-y-2.5">
    {BENEFITS.map(({ icon: Icon, text }) => (
      <li key={text} className="text-footnote flex items-start gap-2.5 text-text-2">
        <Icon size={16} className="mt-0.5 shrink-0 text-success" />
        {text}
      </li>
    ))}
  </ul>
);

const Header = ({ subtitle }: { subtitle: string }) => (
  <div className="mb-5 flex items-center gap-4">
    <Image
      src="/icons/icon-192.png"
      alt=""
      width={64}
      height={64}
      className="h-16 w-16 rounded-[18px] shadow-float"
    />
    <div className="min-w-0">
      <p className="text-title-2 text-text">Install Muvment Driver</p>
      <p className="text-footnote mt-0.5 text-text-3">{subtitle}</p>
    </div>
  </div>
);

const OpenInNotice = ({ browser }: { browser: string }) => (
  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4">
    <Compass size={18} className="mt-0.5 shrink-0 text-warning" />
    <p className="text-footnote text-warning-text">
      This page is open inside another app, which cannot install Muvment Driver. Tap <strong>⋯</strong> or the
      browser icon and choose <strong>Open in {browser}</strong>, then come back here.
    </p>
  </div>
);

/* ------------------------------------------------------------------ sheet */
export const InstallSheet = () => {
  const { environment, hasNativePrompt, isOpen, close, promptInstall } = useInstallPrompt();
  const [isPrompting, setIsPrompting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const { platform, browser, isTablet, isInAppBrowser } = environment;

  const handleNativeInstall = async () => {
    setIsPrompting(true);
    const accepted = await promptInstall();
    setIsPrompting(false);

    if (!accepted) {
      // Chrome only offers the native prompt once per page load; show the menu route instead.
      setShowManual(true);
    }
  };

  const body = (() => {
    if (platform === "ios") {
      if (isInAppBrowser) {
        return (
          <>
            <Header subtitle="iPhone and iPad" />
            <OpenInNotice browser="Safari" />
            <StepList steps={IOS_SAFARI_STEPS(isTablet)} />
          </>
        );
      }

      const isSafari = browser === "safari" || browser === "other";

      return (
        <>
          <Header subtitle={isTablet ? "iPad · add to Home Screen" : "iPhone · add to Home Screen"} />
          <Benefits />
          <StepList steps={isSafari ? IOS_SAFARI_STEPS(isTablet) : IOS_OTHER_BROWSER_STEPS(browserDisplayName[browser])} />
          {!isSafari && (
            <p className="text-caption mt-4 text-text-4">
              Not seeing “Add to Home Screen”? Open this address in Safari, where it is always available.
            </p>
          )}
          <p className="text-caption mt-3 flex items-start gap-1.5 text-text-4">
            <Smartphone size={13} className="mt-0.5 shrink-0" />
            No App Store download needed. The icon on your home screen opens the app full screen.
          </p>
        </>
      );
    }

    if (platform === "android") {
      if (isInAppBrowser) {
        return (
          <>
            <Header subtitle="Android" />
            <OpenInNotice browser="Chrome" />
            <StepList steps={ANDROID_MANUAL_STEPS("chrome")} />
          </>
        );
      }

      if (hasNativePrompt && !showManual) {
        return (
          <>
            <Header subtitle={`Android · ${browserDisplayName[browser]}`} />
            <Benefits />
            <p className="text-footnote mb-4 text-text-2">
              Tap <strong>Install</strong>, then confirm in the window {browserDisplayName[browser]} shows. The app
              is added to your home screen and app drawer in a few seconds, with no Play Store download.
            </p>
          </>
        );
      }

      return (
        <>
          <Header subtitle={`Android · ${browserDisplayName[browser]}`} />
          <Benefits />
          <StepList steps={ANDROID_MANUAL_STEPS(browser)} />
        </>
      );
    }

    return (
      <>
        <Header subtitle="Open on your phone to install" />
        <p className="text-footnote text-text-2">
          Muvment Driver installs on iPhone and Android. Open this address on your phone and follow the prompt.
        </p>
      </>
    );
  })();

  const showNativeButton = platform === "android" && hasNativePrompt && !showManual && !isInAppBrowser;

  return (
    <Sheet open={isOpen} onClose={() => close("dismiss")} ariaLabel="Install Muvment Driver">
      <div className="pb-1">
        {body}

        <div className="mt-6 space-y-3">
          {showNativeButton ? (
            <Button icon={<Download size={18} />} loading={isPrompting} onClick={() => void handleNativeInstall()}>
              Install
            </Button>
          ) : (
            <Button icon={<ArrowUpRight size={18} />} onClick={() => close("installed")}>
              Done, I&apos;ve added it
            </Button>
          )}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => close("later")}
              className="text-callout pressable-soft py-2 font-medium text-accent"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={() => close("never")}
              className="text-callout pressable-soft py-2 text-text-4"
            >
              Don&apos;t ask again
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
};
