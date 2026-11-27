"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface PasswordResetContextValue {
  email: string;
  otp: string;
  setEmail: (email: string) => void;
  setOtp: (otp: string) => void;
  clearResetState: () => void;
}

const PasswordResetContext = createContext<PasswordResetContextValue | null>(null);

const SESSION_KEY = "muvment-driver:password-reset";

const readInitial = () => {
  if (typeof window === "undefined") {
    return { email: "", otp: "" };
  }

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);

    return raw ? (JSON.parse(raw) as { email: string; otp: string }) : { email: "", otp: "" };
  } catch {
    return { email: "", otp: "" };
  }
};

export const PasswordResetProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState(readInitial);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // Best effort only.
    }
  }, [state]);

  // Each setter builds on the latest state, so calling two in a row keeps both changes.
  const value = useMemo(
    () => ({
      email: state.email,
      otp: state.otp,
      setEmail: (email: string) => setState((current) => ({ ...current, email })),
      setOtp: (otp: string) => setState((current) => ({ ...current, otp })),
      clearResetState: () => setState({ email: "", otp: "" }),
    }),
    [state],
  );

  return <PasswordResetContext.Provider value={value}>{children}</PasswordResetContext.Provider>;
};

export const usePasswordReset = () => {
  const context = useContext(PasswordResetContext);

  if (!context) {
    throw new Error("usePasswordReset must be used within a PasswordResetProvider.");
  }

  return context;
};
