export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import VerifyClient from "./verify-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-400">Verifierar…</div>}>
      <VerifyClient />
    </Suspense>
  );
}
