// app/api/group/vote/route.ts
// Alias till befintlig /api/group/votes så att klientanrop mot /api/group/vote fungerar
// utan att ändra UI eller övrig logik.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Återanvänd POST-handlern från ../votes/route (typad med NextRequest)
import { POST as votesPOST } from "../votes/route";

export async function POST(req: NextRequest): Promise<Response> {
  // Projektregel: alltid await cookies() i App Router (server)
  await cookies();
  return votesPOST(req);
}
