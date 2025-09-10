import type { ElementType } from "react";
import { Home, Users, Compass, Bookmark, User } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  Icon: ElementType;
};

export const NAV: ReadonlyArray<NavItem> = [
  { href: "/swipe",     label: "Recs",      Icon: Home },
  { href: "/group",     label: "Grupp",     Icon: Users },
  { href: "/discover",  label: "Discover",  Icon: Compass },
  { href: "/watchlist", label: "Watchlist", Icon: Bookmark },
  { href: "/profile",   label: "Profil",    Icon: User },
] as const;
