import { cookies } from "next/headers";
import MatchOverlayMount from "./MatchOverlayMount";
import Client from "./page_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  // Regler: alltid await cookies() i App Router serverkomponent
  await cookies();

  return (
    <>
      <Client />
      {/* Monterar overlay globalt i swipe-sidan */}
      <MatchOverlayMount />
    </>
  );
}
