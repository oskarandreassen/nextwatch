// app/onboarding/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import OnboardingClient from "./page_client";

export default function OnboardingPage() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Onboarding</h1>
      <Suspense fallback={<div className="text-neutral-400">Laddar…</div>}>
        <OnboardingClient />
      </Suspense>
    </main>
  );
}
