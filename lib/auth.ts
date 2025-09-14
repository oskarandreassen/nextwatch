import { cookies } from 'next/headers';

const FIVE_MIN = 5 * 60; // sekunder
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export function setAuthCookies(uid: string) {
  const jar = cookies();

  // Beständig användar-cookie
  jar.set('nw_uid', uid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: THIRTY_DAYS,
  });

  // Senast autentiserad: nu -> används för 5-min auto-pass på /
  jar.set('nw_last', Date.now().toString(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: FIVE_MIN,
  });
}

export function clearAuthCookies() {
  const jar = cookies();
  jar.set('nw_uid', '', { path: '/', maxAge: 0 });
  jar.set('nw_last', '', { path: '/', maxAge: 0 });
}
