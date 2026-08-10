import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import PWARegister from "./pwa-register";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roval | Daily Routine Tracker",
  description: "A daily routine tracker with a Persian calendar, progress insights, and AI analysis",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Roval" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The dispatch-owned /signin-with-chatgpt route exists only on ChatGPT Sites.
  // Independent hosts (Cloudflare workers.dev/custom domains and localhost)
  // must not redirect to that reserved Sites route. Cloudflare Access, when
  // enabled, protects the Worker before this layout runs; API cloud-sync routes
  // still require a verified Sites identity or Cloudflare Access JWT.
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") ?? "").split(":")[0].toLowerCase();
  if (host.endsWith(".chatgpt.site")) {
    await requireChatGPTUser("/");
  }

  const themeScript = `(function(){try{var t=localStorage.getItem('roval-theme')||'system';var r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r}catch(e){}})()`;
  return <html lang="en" dir="ltr" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><PWARegister />{children}</body></html>;
}
