import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Muvment Driver",
    short_name: "Muvment",
    description: "Professional driver portal for Muvment trips, checklists and navigation.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1D2739",
    theme_color: "#1D2739",
    categories: ["business", "navigation", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Trips", url: "/trips", description: "Open your assigned trips" },
      { name: "Notifications", url: "/notifications" },
    ],
  };
}
