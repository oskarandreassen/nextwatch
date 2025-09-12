// components/navigation/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/components/lib/nav";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col p-4">
      <div className="px-2 py-3 text-lg font-semibold">NextWatch</div>
      <div className="mt-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.activeStartsWith ?? "///nope");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-md px-3 py-2 text-sm",
                active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
