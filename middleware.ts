// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED = [/^\/swipe($|\/)/, /^\/group\/swipe($|\/)/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsGate = PROTECTED.some((re) => re.test(pathname));
  if (!needsGate) return NextResponse.next();

  // kontrollera profil via API (bär med cookies)
  const url = new URL("/api/profile/exists", req.nextUrl.origin);
  const res = await fetch(url.toString(), {
    headers: { cookie: req.headers.get("cookie") || "" },
  }).catch(() => null);

  const ok = !!res && res.ok;
  const data = ok ? await res!.json().catch(() => null) : null;
  const hasProfile = !!(data && data.ok && data.hasProfile);

  if (!hasProfile) {
    const redirectUrl = new URL("/onboarding", req.nextUrl.origin);
    redirectUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/session/init|favicon.ico).*)"],
};
