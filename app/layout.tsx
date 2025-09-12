// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layouts/AppShell";

export const metadata: Metadata = {
  title: "NextWatch",
  description: "Swipe your next movie or show",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
