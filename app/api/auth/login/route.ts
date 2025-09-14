import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { verifyPassword } from '../../../../lib/hash';
import { setAuthCookies } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginBody = { email: string; password: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Saknar e-post/lösenord' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Fel e-post eller lösenord' }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ ok: false, error: 'E-post ej verifierad' }, { status: 403 });
    }

    if (!user.passwordHash) {
      return NextResponse.json({ ok: false, error: 'Inget lösenord satt för detta konto' }, { status: 403 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Fel e-post eller lösenord' }, { status: 401 });
    }

    setAuthCookies(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
