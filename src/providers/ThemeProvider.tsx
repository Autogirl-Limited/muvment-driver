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

/**
 * Colours painted into the device chrome. On Android the `theme-color` meta
 * tints the status bar and, in an installed app, the system navigation bar;
 * on iOS (home-screen app, status bar style "default") it tints the status
 * bar and iOS picks black or white glyphs from its luminance. Keep these in
 * sync with --bg in globals.css.
 */
export const CHROME_COLORS = { light: "#F5F6F8", dark: "#0B1220" } as const;

const isThemePreference = (value: string | null): value is ThemePreference =>
  Boolean(value && THEME_PREFERENCES.includes(value as ThemePreference));

interface ThemeContextValue {
  isDark: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  themePreference: ThemePreference;
  /** Override the device chrome colour for the current screen (e.g. a coloured header). */
  setScreenThemeColor: (color: string | null) => void;
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

/** Writes the single theme-color meta the device chrome reads. */
const applyThemeColor = (color: string) => {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }

  // Media-scoped variants would outrank ours while the in-app toggle is set; drop them.
  document.querySelectorAll('meta[name="theme-color"][media]').forEach((element) => element.remove());

  if (meta.content !== color) {
    meta.content = color;
  }
};

/**
 * Runs before paint so the first frame already has the stored theme and the
 * matching chrome colour. Mirrors applyTheme/applyThemeColor; keep in sync.
 */
export const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=document.documentElement;if(t==="dark"||t==="light"){d.setAttribute("data-theme",t);}var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var m=document.querySelector('meta[name="theme-color"]:not([media])');if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m);}m.content=dark?${JSON.stringify(CHROME_COLORS.dark)}:${JSON.stringify(CHROME_COLORS.light)};}catch(e){}})();`,
    }}
  />
);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [systemIsDark, setSystemIsDark] = useState(false);
  const [screenThemeColor, setScreenThemeColor] = useState<string | null>(null);

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
    applyThemeColor(screenThemeColor ?? (isDark ? CHROME_COLORS.dark : CHROME_COLORS.light));
  }, [isDark, screenThemeColor]);

  const value = useMemo(
    () => ({ isDark, setThemePreference, themePreference, setScreenThemeColor }),
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

/**
 * Tints the device status bar (and Android nav bar) to match a screen's own
 * header colour while that screen is mounted, e.g. the navy Home header.
 * Pass the same colour for light and dark when the header does not change.
 */
export const useScreenThemeColor = (color: string | { light: string; dark: string } | null) => {
  const { isDark, setScreenThemeColor } = useTheme();
  const resolved = color === null ? null : typeof color === "string" ? color : isDark ? color.dark : color.light;

  useEffect(() => {
    setScreenThemeColor(resolved);

    return () => setScreenThemeColor(null);
  }, [resolved, setScreenThemeColor]);
};
