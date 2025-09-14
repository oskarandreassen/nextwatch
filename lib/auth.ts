// lib/auth.ts
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sätter våra sessions-cookies på ett givet NextResponse-objekt.
 * Använd i route handlers efter lyckad auth/verifiering.
 */
export function attachSessionCookies(
  res: NextResponse,
  uid: string,
  opts?: { remember?: boolean }
) {
  const oneYear = 60 * 60 * 24 * 365;
  const thirtyDays = 60 * 60 * 24 * 30;

  res.cookies.set('nw_uid', uid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: opts?.remember ? oneYear : thirtyDays,
  });

  // “Senast aktiv” – används för 5-minuterspass på / (landing)
  res.cookies.set('nw_last', String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 5,
  });

  return res;
}

/**
 * Hjälpare för redirect + session på en gång.
 * Skicka in `req` om du skickar relativ path (t.ex. '/swipe') så vi kan skapa absolut URL.
 */
export function sessionRedirect(
  target: string | URL,
  uid: string,
  req?: NextRequest,
  opts?: { remember?: boolean }
) {
  const url =
    target instanceof URL
      ? target
      : target.startsWith('http')
      ? new URL(target)
      : new URL(target, req?.url ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');

  const res = NextResponse.redirect(url);
  return attachSessionCookies(res, uid, opts);
}

/**
 * Endast uppdatera "nw_last" på ett befintligt svar (t.ex. ping-endpoint).
 */
export function touchLastSeen(res: NextResponse) {
  res.cookies.set('nw_last', String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 5,
  });
  return res;
}
