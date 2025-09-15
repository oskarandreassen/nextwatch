// app/api/debug/db/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskDbUrl(raw?: string | null) {
  if (!raw) return null;
  try {
    // postgres://user:pass@host/db?params
    const u = new URL(raw);
    const host = u.hostname;
    const db = u.pathname.replace(/^\//, "");
    return `${host}/${db}`;
  } catch {
    return "unparseable";
  }
}

async function introspect() {
  const [usersCols, verCols, meta] = await Promise.all([
    prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `,
    prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'verifications'
      ORDER BY ordinal_position
    `,
    prisma.$queryRaw<Array<{ current_database: string; current_schema: string; version: string }>>`
      SELECT current_database(), current_schema(), version()
    `,
  ]);

  const userCols = usersCols.map((r) => r.column_name);
  const verColsArr = verCols.map((r) => r.column_name);

  const missingUsers = ["email_verified", "password_hash", "last_login_at"].filter(
    (c) => !userCols.includes(c)
  );
  const missingVerifications = ["token", "user_id", "email", "name", "created_at", "expires_at"].filter(
    (c) => !verColsArr.includes(c)
  );

  return {
    envDatabaseUrl: maskDbUrl(process.env.DATABASE_URL),
    meta: meta[0],
    users: { columns: usersCols, missing: missingUsers },
    verifications: { columns: verCols, missing: missingVerifications },
  };
}

async function autofix() {
  // Kör samma idempotenta SQL som i din SQL-editor – men bara det nödvändiga.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS password_hash  TEXT,
      ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMP NULL;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS verifications (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      name        TEXT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMP NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_verifications_email   ON verifications(email);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verifications(user_id);
  `);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fix = url.searchParams.get("fix") === "1";

    const before = await introspect();

    if (fix) {
      await autofix();
    }

    const after = await introspect();

    return NextResponse.json({
      ok: true,
      note:
        "Denna debug-route är tillfällig. Anropa med ?fix=1 för att köra idempotenta ALTER/CREATE i den aktiva databasen.",
      before,
      after,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internt fel.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
