// app/api/group/route.ts
import { NextResponse } from "next/server";

/**
 * GET /api/group?code=XXXXXX
 * Flyttad hit för att undvika kollision med app/group/page.tsx.
 * Lägg din tidigare Prisma/valideringslogik här.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    return NextResponse.json(
      {
        ok: true,
        code,
        message:
          "Group API route is alive. Move your previous GET logic from app/group/route.ts (or page.tsx) into this handler.",
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

// Om du hade POST/PUT/DELETE i page.tsx/route.ts, flytta dem hit också:
// export async function POST(req: Request) { ... }
