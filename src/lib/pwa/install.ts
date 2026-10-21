import { storage } from "@/lib/utils/storage";

/**
 * Everything the install prompt needs to know about where the app is running:
 * which OS, which browser, whether it is already installed, and whether the
 * driver asked not to be reminded.
 */
export type InstallPlatform = "ios" | "android" | "other";

export type InstallBrowser =
  | "safari"
  | "chrome"
  | "samsung"
  | "firefox"
  | "edge"
  | "opera"
  | "in-app"
  | "other";

export interface InstallEnvironment {
  platform: InstallPlatform;
  browser: InstallBrowser;
  /** iPad reports itself as a Mac since iPadOS 13; we still treat it as iOS. */
  isTablet: boolean;
  isStandalone: boolean;
  /** Facebook, Instagram, WhatsApp, Gmail… web views cannot install a PWA. */
  isInAppBrowser: boolean;
}

const DISMISS_KEY = "install-prompt.dismissed-until";
const NEVER_KEY = "install-prompt.never";
const INSTALLED_KEY = "install-prompt.installed";
const LATER_DAYS = 3;

export const detectInstallEnvironment = (): InstallEnvironment => {
  if (typeof window === "undefined") {
    return { platform: "other", browser: "other", isTablet: false, isStandalone: false, isInAppBrowser: false };
  }

  const ua = navigator.userAgent || "";
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isIos = /iPhone|iPad|iPod/i.test(ua) || isIpadOs;
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|GSA\/|Snapchat|TikTok|wv\)|; wv/i.test(ua);

  let browser: InstallBrowser = "other";

  if (isInAppBrowser) {
    browser = "in-app";
  } else if (isIos) {
    if (/CriOS/i.test(ua)) browser = "chrome";
    else if (/FxiOS/i.test(ua)) browser = "firefox";
    else if (/EdgiOS/i.test(ua)) browser = "edge";
    else if (/OPiOS|OPT\//i.test(ua)) browser = "opera";
    else if (/Safari/i.test(ua)) browser = "safari";
  } else if (isAndroid) {
    if (/SamsungBrowser/i.test(ua)) browser = "samsung";
    else if (/EdgA/i.test(ua)) browser = "edge";
    else if (/OPR\//i.test(ua)) browser = "opera";
    else if (/Firefox/i.test(ua)) browser = "firefox";
    else if (/Chrome/i.test(ua)) browser = "chrome";
  }

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://");

  return {
    platform: isIos ? "ios" : isAndroid ? "android" : "other",
    browser,
    isTablet: isIpadOs || /iPad/i.test(ua) || (isAndroid && !/Mobile/i.test(ua)),
    isStandalone,
    isInAppBrowser,
  };
};

export const isInstallPromptSnoozed = () => {
  if (storage.get(NEVER_KEY) === "true" || storage.get(INSTALLED_KEY) === "true") {
    return true;
  }

  const until = Number(storage.get(DISMISS_KEY) ?? 0);

  return Number.isFinite(until) && until > Date.now();
};

export const snoozeInstallPrompt = () => {
  storage.set(DISMISS_KEY, String(Date.now() + LATER_DAYS * 24 * 60 * 60 * 1000));
};

export const neverShowInstallPrompt = () => {
  storage.set(NEVER_KEY, "true");
};

export const markInstalled = () => {
  storage.set(INSTALLED_KEY, "true");
};

export const resetInstallPromptPreference = () => {
  storage.remove(DISMISS_KEY);
  storage.remove(NEVER_KEY);
};

/** Chrome / Edge / Samsung Internet on Android fire this before showing their own mini-infobar. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}
