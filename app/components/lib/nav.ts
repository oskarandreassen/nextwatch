export type NavItem = {
  href: string;
  label: string;
  icon: string; // lucide icon name string we render in Sidebar/BottomTabs
};

export const NAV: NavItem[] = [
  { href: "/swipe",      label: "Recommendations", icon: "Flame" },
  { href: "/group",      label: "Grupp",           icon: "Users" },
  { href: "/discover",   label: "Discover",        icon: "Search" },
  { href: "/watchlist",  label: "Watchlist",       icon: "Bookmark" },
  { href: "/profile",    label: "Profil",          icon: "User" },
];
