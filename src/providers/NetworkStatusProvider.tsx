"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onlineManager } from "@tanstack/react-query";

type NetworkStatusContextValue = {
  isOffline: boolean;
  isOnline: boolean;
};

const NetworkStatusContext = createContext<NetworkStatusContextValue | undefined>(undefined);

export const NetworkStatusProvider = ({ children }: { children: ReactNode }) => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const unsubscribe = onlineManager.subscribe((online) => setIsOnline(online));

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ isOffline: !isOnline, isOnline }), [isOnline]);

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>;
};

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);

  if (!context) {
    throw new Error("useNetworkStatus must be used within NetworkStatusProvider");
  }

  return context;
};
