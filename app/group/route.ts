// app/group/route.ts
import { NextResponse } from "next/server";

/**
 * GET /group?code=XXXXXX
 * Flyttad hit från page.tsx (page-filer får inte exportera HTTP-metoder i App Router).
 * Den här minsta varianten ekar bara ut koden så att befintliga anrop inte bryts.
 * Fyll gärna på med din tidigare logik (Prisma, validering, mm.) här.
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
          "Group route is alive. Move your previous GET logic from app/group/page.tsx into this handler.",
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

// (Om du hade POST/PUT/DELETE i page.tsx, flytta dem hit också, t.ex.)
// export async function POST(req: Request) { ... }
