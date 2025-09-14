// lib/auth.ts
import { NextResponse, type NextRequest } from 'next/server';

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

  // “senast aktiv” (5 min)
  res.cookies.set('nw_last', String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 5,
  });

  return res;
}

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
      : new URL(
          target,
          req?.url ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
        );

  const res = NextResponse.redirect(url);
  return attachSessionCookies(res, uid, opts);
}

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

export function clearAuthCookies(res: NextResponse) {
  // rensa båda cookies på ett säkert sätt
  res.cookies.set('nw_uid', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  });
  res.cookies.set('nw_last', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}

/** Backwards-compat alias (så att befintliga imports fortsätter fungera) */
export const setAuthCookies = attachSessionCookies;
