// app/group/swipe/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import GroupBar from "./GroupBar";
import MatchOverlay from "../../components/ui/MatchOverlay";

const LegacyGroupSwipe = dynamic(() => import("./_legacy"), { ssr: false });
// ^ Om du har din nuvarande implementering direkt i denna fil: 
// 1) Lägg den i app/group/swipe/_legacy.tsx (kopiera nuvarande innehåll)
// 2) Då får du header + popup utan att ändra din kortlogik.

export default function GroupSwipePage() {
  const sp = useSearchParams();
  const code = (sp.get("code") || "").toUpperCase();

  return (
    <main className="mx-auto w-full max-w-3xl pb-16">
      <GroupBar code={code} />
      {/* Din existerande swipelogik i _legacy.tsx */}
      <LegacyGroupSwipe />
      <MatchOverlay code={code} />
    </main>
  );
}
