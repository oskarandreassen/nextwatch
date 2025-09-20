// app/components/navigation/BottomTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "../lib/nav";

export default function BottomTabs() {
  const pathname = usePathname();

  return (
    // sänkt från z-40 till z-20 så modaler/sheets (z-30+) alltid hamnar över
    <div className="sticky bottom-0 z-20 border-t border-neutral-800/80 bg-neutral-900/70 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-1 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.activeStartsWith);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className="relative flex flex-col items-center justify-center gap-1 px-2 py-1 text-[11px]"
            >
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full transition",
                  active ? "bg-white text-neutral-900" : "text-neutral-300",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className={active ? "font-medium text-white" : "text-neutral-400"}>
                {item.short}
              </div>
              {active && (
                <span className="absolute inset-x-6 -bottom-1 h-1 rounded-full bg-white/90" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
