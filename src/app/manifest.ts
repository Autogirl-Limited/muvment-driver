import type { MetadataRoute } from "next";

// Web app manifest: makes the app installable on Android (and desktop Chrome/Edge).
// iOS reads the apple-* tags from the root layout. The icon set is shared with the
// customer app (muvment-customer/public/icons) so both apps look alike on a phone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Muvment Driver by Autogirl",
    short_name: "Muvment Driver",
    description: "Professional driver portal for Muvment trips, checklists and navigation.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "transportation", "navigation"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Trips",
        url: "/trips",
        description: "Open your assigned trips",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Notifications",
        url: "/notifications",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
