"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "../../lib/nav";
import { NAV } from "../../../lib/nav";
import clsx from "clsx";

type Props = { className?: string };

export default function BottomTabs({ className }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className={clsx(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "pb-[max(12px,env(safe-area-inset-bottom))] pt-2",
        "backdrop-blur bg-black/60 border-t border-white/10",
        className
      )}
      role="navigation"
      aria-label="Huvudnavigation"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-3">
        {NAV.map((item: NavItem) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                className={clsx(
                  "flex w-full flex-col items-center justify-center rounded-xl py-2 text-xs",
                  active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
                )}
              >
                <item.Icon className="h-5 w-5 mb-1" aria-hidden />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
