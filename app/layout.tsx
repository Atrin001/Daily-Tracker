import type { Metadata } from "next";
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
  await requireChatGPTUser("/");
  const themeScript = `(function(){try{var t=localStorage.getItem('roval-theme')||'system';var r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r}catch(e){}})()`;
  return <html lang="en" dir="ltr" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><PWARegister />{children}</body></html>;
}
