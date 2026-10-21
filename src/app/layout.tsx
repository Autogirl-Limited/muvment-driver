import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppProviders } from "@/providers/AppProviders";
import { MobileOnlyGate } from "@/components/system/MobileOnlyGate";
import { ThemeScript } from "@/providers/ThemeProvider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Muvment Driver",
    template: "%s · Muvment Driver",
  },
  description: "Professional driver portal for Muvment trips, checklists and navigation.",
  applicationName: "Muvment Driver",
  manifest: "/manifest.webmanifest",
  // "default" lets iOS colour the status bar from the theme-color meta and pick
  // dark or light glyphs to match; "black-translucent" would force white text
  // even on the light theme. iOS reads this only when the app is added to the
  // Home Screen, so a reinstall is needed to pick up a change.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Muvment",
  },
  formatDetection: { telephone: false },
  // Same icon set as the customer app (muvment-customer) so both Muvment apps
  // share one identity on the home screen and in the browser tab.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // theme-color is owned by ThemeProvider/ThemeScript so it follows the in-app
  // theme toggle and per-screen header colours, not only the system setting.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans">
        <AppProviders>
          <MobileOnlyGate>{children}</MobileOnlyGate>
        </AppProviders>
      </body>
    </html>
  );
}
