import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

interface ScreenProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  /** Add space for the floating tab bar at the bottom. */
  withTabBar?: boolean;
}

/**
 * Full-height scroll container with safe-area padding. Each screen scrolls
 * inside this element rather than the document, so headers can stay put and
 * iOS rubber-banding happens inside the view.
 */
export const Screen = ({ children, className = "", withTabBar = false, style, ...rest }: ScreenProps) => {
  const mergedStyle: CSSProperties = {
    paddingBottom: withTabBar
      ? "calc(var(--tab-bar-height) + var(--safe-bottom) + 24px)"
      : "var(--safe-bottom)",
    ...style,
  };

  return (
    <div className={`scroll-y relative flex h-dvh flex-col bg-bg ${className}`} style={mergedStyle} {...rest}>
      {children}
    </div>
  );
};

interface NavBarProps {
  left?: ReactNode;
  right?: ReactNode;
  title?: string;
  /** Large iOS-style title under the bar. */
  largeTitle?: string;
  subtitle?: string;
  className?: string;
}

export const NavBar = ({ left, right, title, largeTitle, subtitle, className = "" }: NavBarProps) => (
  <header className={`safe-top relative px-5 ${className}`}>
    <div className="flex h-12 items-center justify-between">
      <div className="flex min-w-0 items-center">{left}</div>
      {title && (
        <h1 className="text-headline pointer-events-none absolute left-1/2 -translate-x-1/2 text-text">{title}</h1>
      )}
      <div className="flex items-center gap-2">{right}</div>
    </div>
    {largeTitle && (
      <div className="pt-1 pb-3">
        <h1 className="text-large-title text-text">{largeTitle}</h1>
        {subtitle && <p className="text-callout mt-1 text-text-3">{subtitle}</p>}
      </div>
    )}
  </header>
);

export const SectionHeader = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`text-eyebrow mb-3 text-text-3 ${className}`}>{children}</p>
);

export const Divider = ({ className = "" }: { className?: string }) => (
  <div className={`h-px w-full bg-separator ${className}`} />
);
