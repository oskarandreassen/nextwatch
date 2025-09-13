// app/swipe/Client.tsx
"use client";

import dynamic from "next/dynamic";

// Flytta din nuvarande swipe-implementation från app/swipe/page.tsx
// till _legacy.tsx och exportera en default React-komponent där.
const LegacySwipe = dynamic(() => import("./_legacy"), { ssr: false });

export default function Client() {
  return <LegacySwipe />;
}
