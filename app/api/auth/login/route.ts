import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { verifyPassword } from '../../../../lib/hash';
import { setAuthCookies } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as {
      email?: string;
      password?: string;
    };
    if (!email || !password) {
      return NextResponse.json({ ok: false, message: 'Missing credentials' }, { status: 400 });
    }

    // ⚠️ Håll detta i linje med ditt faktiska schema (fältnamn)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, emailVerified: true } as const,
    });

    if (!user?.passwordHash) {
      return NextResponse.json({ ok: false, message: 'Invalid credentials' }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ ok: false, message: 'Invalid credentials' }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json({ ok: false, message: 'Email not verified' }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, user.id);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
