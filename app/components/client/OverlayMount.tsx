"use client";

import dynamic from "next/dynamic";

// Ladda MatchOverlay endast på klienten
const MatchOverlay = dynamic(() => import("../ui/MatchOverlay"), { ssr: false });

export default function OverlayMount() {
  return <MatchOverlay />;
}
