import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import AppShell from "./components/layouts/AppShell";
import dynamic from "next/dynamic";
import { cookies } from "next/headers";

// Ladda client-komponenten endast på klienten
const MatchOverlay = dynamic(() => import("./components/ui/MatchOverlay"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "NextWatch",
  description: "Swipe your next watch",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // App Router server-regel
  await cookies();

  return (
    <html lang="sv">
      <body>
        <AppShell>{children}</AppShell>

        {/* Global overlay: läser nw_group från cookie själv */}
        <MatchOverlay />
      </body>
    </html>
  );
}
