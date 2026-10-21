"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "dark" | "light" | "system";

const THEME_STORAGE_KEY = "muvment-driver:themePreference";
const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

const isThemePreference = (value: string | null): value is ThemePreference =>
  Boolean(value && THEME_PREFERENCES.includes(value as ThemePreference));

interface ThemeContextValue {
  isDark: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  themePreference: ThemePreference;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const applyTheme = (preference: ThemePreference) => {
  const root = document.documentElement;

  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }
};

const getSystemIsDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * Runs before paint so the first frame already has the stored theme. Mirrors
 * the logic in applyTheme; keep both in sync.
 */
export const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{var t=localStorage.getItem(${JSON.stringify(
        THEME_STORAGE_KEY,
      )});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`,
    }}
  />
);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [systemIsDark, setSystemIsDark] = useState(false);

  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }

    if (isThemePreference(stored)) {
      setThemePreferenceState(stored);
    }

    setSystemIsDark(getSystemIsDark());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);

    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
    applyTheme(preference);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Best effort only.
    }
  }, []);

  const isDark = themePreference === "system" ? systemIsDark : themePreference === "dark";

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    const color = isDark ? "#0B1220" : "#F5F6F8";

    if (meta) {
      meta.setAttribute("content", color);
    } else {
      const element = document.createElement("meta");
      element.name = "theme-color";
      element.content = color;
      document.head.appendChild(element);
    }
  }, [isDark]);

  const value = useMemo(
    () => ({ isDark, setThemePreference, themePreference }),
    [isDark, setThemePreference, themePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
};
