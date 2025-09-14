import { NextResponse } from 'next/server';
import { clearAuthCookies } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  clearAuthCookies();
  return NextResponse.json({ ok: true });
}
