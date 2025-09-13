// app/components/navigation/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "../lib/nav";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-dvh w-64 flex-col border-r border-neutral-800 bg-neutral-900/60 backdrop-blur">
      <div className="px-4 py-4 text-lg font-semibold text-white/90">NextWatch</div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.activeStartsWith);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-white text-neutral-900"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 text-xs text-neutral-500">© NextWatch</div>
    </aside>
  );
}
