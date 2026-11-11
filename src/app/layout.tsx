import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/800.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { default: "Pacepact", template: "%s · Pacepact" },
  description: "Set a race goal, follow a simple plan, log runs automatically and train together in groups.",
};

export const viewport: Viewport = { themeColor: "#143a80", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
