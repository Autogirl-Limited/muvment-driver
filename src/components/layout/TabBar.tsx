"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Home, Settings } from "lucide-react";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/trips", label: "Trips", icon: Car },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** Translucent iOS tab bar. Content scrolls underneath it. */
export const TabBar = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch" style={{ height: "var(--tab-bar-height)" }}>
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`pressable-soft flex h-full flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? "text-accent" : "text-text-4"
                }`}
              >
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.4 : 2}
                  style={{
                    transform: isActive ? "scale(1.06) translateY(-1px)" : "scale(1)",
                    transition: "transform var(--dur) var(--ease-spring-bounce)",
                  }}
                />
                <span className="text-[11px] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
