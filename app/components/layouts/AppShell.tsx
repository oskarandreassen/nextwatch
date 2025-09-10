"use client";

import type { PropsWithChildren } from "react";
import Sidebar from "../navigation/Sidebar";
import BottomTabs from "../navigation/BottomTabs";

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto grid w-full max-w-6xl md:grid-cols-[240px_1fr]">
        <Sidebar />
        <main className="min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
