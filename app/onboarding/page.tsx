// app/onboarding/page.tsx
import { cookies } from "next/headers";
import Client from "./page_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // Regler: alltid await cookies() i App Router (server)
  await cookies();
  // Ingen extra rubrik här – klienten står för UI:t.
  return <Client />;
}
