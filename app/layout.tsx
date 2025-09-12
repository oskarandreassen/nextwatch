// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Toast from "./components/ui/Toast"; // ny liten toast-komponent nedan

export const metadata: Metadata = {
  title: "NextWatch",
  description: "Swipe your next movie or show",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-neutral-950 text-neutral-100 antialiased">
        {children}
        <Toast />
      </body>
    </html>
  );
}
