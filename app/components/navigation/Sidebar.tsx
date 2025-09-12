// app/components/navigation/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "../lib/nav";

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <div className="flex h-dvh flex-col">
      <div className="px-4 py-4 text-lg font-semibold text-white/90">NextWatch</div>
      <div className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.activeStartsWith ?? "///nope");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-white text-neutral-900"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="px-4 py-3 text-xs text-neutral-500">© NextWatch</div>
    </div>
  );
}
