"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  detectInstallEnvironment,
  isInstallPromptSnoozed,
  markInstalled,
  neverShowInstallPrompt,
  snoozeInstallPrompt,
  type BeforeInstallPromptEvent,
  type InstallEnvironment,
} from "@/lib/pwa/install";

/** Delay before the sheet rises on its own after the signed-in shell mounts. */
const AUTO_SHOW_DELAY_MS = 2500;

interface InstallPromptContextValue {
  environment: InstallEnvironment;
  /** True when the browser handed us a native install prompt (Android Chrome family). */
  hasNativePrompt: boolean;
  isInstalled: boolean;
  /** Whether the "Install app" entry points should be shown at all. */
  isEligible: boolean;
  isOpen: boolean;
  open: () => void;
  close: (reason: "later" | "never" | "installed" | "dismiss") => void;
  /** Triggers the native Android prompt. Resolves to true when the driver accepted. */
  promptInstall: () => Promise<boolean>;
}

const InstallPromptContext = createContext<InstallPromptContextValue | undefined>(undefined);

export const InstallPromptProvider = ({ children, autoShow = true }: { children: ReactNode; autoShow?: boolean }) => {
  const [environment, setEnvironment] = useState<InstallEnvironment>(() => ({
    platform: "other",
    browser: "other",
    isTablet: false,
    isStandalone: false,
    isInAppBrowser: false,
  }));
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const autoShown = useRef(false);

  useEffect(() => {
    const detected = detectInstallEnvironment();

    setEnvironment(detected);
    setIsInstalled(detected.isStandalone);

    const onBeforeInstallPrompt = (event: Event) => {
      // Keep the browser's own mini-infobar away; we show the branded sheet instead.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      markInstalled();
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsOpen(false);
    };
    const media = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        onAppInstalled();
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    media.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      media.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const isEligible = !isInstalled && (environment.platform === "ios" || environment.platform === "android");

  useEffect(() => {
    if (!autoShow || !isEligible || autoShown.current || isInstallPromptSnoozed()) {
      return;
    }

    autoShown.current = true;
    const timer = setTimeout(() => setIsOpen(true), AUTO_SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, [autoShow, isEligible]);

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback((reason: "later" | "never" | "installed" | "dismiss") => {
    if (reason === "later" || reason === "dismiss") {
      snoozeInstallPrompt();
    } else if (reason === "never") {
      neverShowInstallPrompt();
    } else {
      markInstalled();
      setIsInstalled(true);
    }

    setIsOpen(false);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      setDeferredPrompt(null);

      if (choice.outcome === "accepted") {
        markInstalled();
        setIsInstalled(true);
        setIsOpen(false);
        return true;
      }

      snoozeInstallPrompt();
      return false;
    } catch {
      setDeferredPrompt(null);
      return false;
    }
  }, [deferredPrompt]);

  const value = useMemo<InstallPromptContextValue>(
    () => ({
      environment,
      hasNativePrompt: deferredPrompt !== null,
      isInstalled,
      isEligible,
      isOpen,
      open,
      close,
      promptInstall,
    }),
    [close, deferredPrompt, environment, isEligible, isInstalled, isOpen, open, promptInstall],
  );

  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>;
};

export const useInstallPrompt = () => {
  const context = useContext(InstallPromptContext);

  if (!context) {
    throw new Error("useInstallPrompt must be used within InstallPromptProvider.");
  }

  return context;
};
