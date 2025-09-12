// app/components/navigation/BottomTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "../lib/nav";

export default function BottomTabs() {
  const pathname = usePathname();
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.activeStartsWith ?? "///nope");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center justify-center px-2 py-3 text-xs",
                active ? "font-semibold text-white" : "text-neutral-400",
              ].join(" ")}
            >
              {item.short ?? item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
