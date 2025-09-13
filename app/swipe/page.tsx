// app/swipe/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Client from "./Client";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-400">Laddar rekommendationer…</div>}>
      <Client />
    </Suspense>
  );
}
