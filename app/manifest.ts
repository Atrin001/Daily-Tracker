import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roval — Daily Routine Tracker",
    short_name: "Roval",
    description: "A synced routine tracker with a Persian calendar and AI insights.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f8f4",
    theme_color: "#164f42",
    orientation: "any",
    categories: ["productivity", "lifestyle", "utilities"],
    shortcuts: [
      { name: "Today", short_name: "Today", description: "Open today's routine", url: "/?view=today", icons: [{ src: "/app-icon.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Weekly insights", short_name: "Insights", description: "Review your progress", url: "/?view=insights", icons: [{ src: "/app-icon.svg", sizes: "any", type: "image/svg+xml" }] },
    ],
    icons: [
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
