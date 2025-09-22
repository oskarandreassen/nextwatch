import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import AppShell from "./components/layouts/AppShell";
import OverlayMount from "./components/client/OverlayMount";
import { cookies } from "next/headers";
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: "NextWatch",
  description: "Swipe your next watch",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // App Router-regeln: anropa cookies() på serversidan
  await cookies();

  return (
    <html lang="sv">
      <body>
        <AppShell>{children}</AppShell>

        {/* Global overlay – körs endast på klienten via OverlayMount */}
        <OverlayMount />
      </body>
    </html>
  );
}
