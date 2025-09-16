// app/api/recs/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { GET as GETForYou } from "./for-you/route";

export async function GET(req: NextRequest) {
  return GETForYou(req);
}
