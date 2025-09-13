// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED = [/^\/swipe($|\/)/, /^\/group\/swipe($|\/)/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();

  const url = new URL("/api/profile/exists", req.nextUrl.origin);
  const res = await fetch(url, { headers: { cookie: req.headers.get("cookie") || "" } }).catch(() => null);
  const ok = res?.ok;
  const data = ok ? await res!.json().catch(() => null) : null;
  if (!data?.ok || !data.hasProfile) {
    const redirectUrl = new URL("/onboarding", req.nextUrl.origin);
    redirectUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|api/session/init|favicon.ico).*)"] };
