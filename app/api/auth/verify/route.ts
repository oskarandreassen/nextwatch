import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, message: string, extra?: Record<string, unknown>) {
  const body: Record<string, unknown> = { ok: false, message };
  if (extra) body.debug = extra;
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return fail(400, "Token saknas.");

    const v = await prisma.verification.findUnique({
      where: { token },
      select: { token: true, userId: true, email: true, expiresAt: true },
    });
    if (!v) return fail(404, "Ogiltig eller förbrukad token.");

    if (v.expiresAt && v.expiresAt.getTime() < Date.now()) {
      await prisma.verification.delete({ where: { token } }).catch(() => {});
      return fail(410, "Token har gått ut.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: v.userId },
        data: { emailVerified: new Date() },
      }),
      prisma.verification.delete({ where: { token } }),
    ]);

    return NextResponse.json({ ok: true, message: "E-post verifierad." });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return fail(500, "Databasfel.", { code: err.code, meta: err.meta });
    }
    const msg = err instanceof Error ? err.message : "Internt fel.";
    return fail(500, msg);
  }
}
