// app/api/recs/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Viktigt: importera, men re-exportera inte konstanta fält.
// Gör istället en tunn proxy-funktion så Next ser runtime/dynamic här.
import type { NextRequest } from "next/server";
import { GET as GETForYou } from "./for-you/route";

export async function GET(req: NextRequest) {
  return GETForYou(req);
}
