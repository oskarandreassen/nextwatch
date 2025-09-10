"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "../../lib/nav";
import { NAV } from "../../lib/nav";
import clsx from "clsx";

type Props = { className?: string };

export default function Sidebar({ className }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        "hidden md:block md:sticky md:top-0 md:h-dvh",
        "border-r border-white/10 bg-black/40 backdrop-blur",
        className
      )}
    >
      <div className="p-4">
        <div className="mb-4 text-lg font-semibold">nextwatch</div>
        <nav className="space-y-1" aria-label="Huvudnavigation">
          {NAV.map((item: NavItem) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2",
                  active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
                )}
              >
                <item.Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
