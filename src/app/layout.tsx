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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Muvment",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/favicon.png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F6F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
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
