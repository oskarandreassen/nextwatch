// app/group/swipe/Client.tsx
"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import GroupBar from "./GroupBar";
import MatchOverlay from "../../components/ui/MatchOverlay";

// Din befintliga swipelogik flyttad till _legacy (eller redan där)
const LegacyGroupSwipe = dynamic(() => import("./_legacy"), { ssr: false });

export default function Client() {
  const sp = useSearchParams();
  const code = (sp.get("code") || "").toUpperCase();

  return (
    <>
      <GroupBar code={code} />
      <LegacyGroupSwipe />
      <MatchOverlay code={code} />
    </>
  );
}
