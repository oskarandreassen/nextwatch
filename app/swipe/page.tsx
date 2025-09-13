// app/swipe/page.tsx
import { Suspense } from "react";
import Client from "./Client";

export const dynamic = "force-dynamic";

export default function SwipePageWrapper() {
  return (
    <main className="mx-auto w-full max-w-3xl pb-16">
      <Suspense fallback={<div className="p-6 text-neutral-400">Laddar…</div>}>
        <Client />
      </Suspense>
    </main>
  );
}
