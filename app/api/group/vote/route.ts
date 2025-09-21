// app/api/group/vote/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Återanvänd befintlig implementation i /api/group/votes
import { POST as votesPOST } from "../votes/route";

export async function POST(req: Request) {
  return votesPOST(req);
}
