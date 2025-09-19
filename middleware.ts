// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED = [/^\/swipe($|\/)/, /^\/group\/swipe($|\/)/];

// ——— helpers ———
function makeUid(): string {
  const c = crypto as Crypto & { randomUUID?: () => string };
  return typeof c.randomUUID === "function"
    ? c.randomUUID()
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function pickLocale(acceptLang: string | null, region: string): string {
  const first = (acceptLang ?? "").split(",")[0]?.trim() ?? "";
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(first)) {
    return first.includes("-") ? first : `${first}-${region}`;
  }
  return "sv-SE";
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED.some((re) => re.test(pathname));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1) Se till att nw_uid / nw_region / nw_locale alltid finns
  let uid = req.cookies.get("nw_uid")?.value ?? null;
  const mustSetUid = !uid;
  if (!uid) uid = makeUid();

  // Använd endast Vercel-headern (ingen req.geo för att undvika TS-problem)
  const headerRegion = req.headers.get("x-vercel-ip-country") ?? "";
  const region = /^[A-Z]{2}$/.test(headerRegion) ? headerRegion : "SE";
  const locale = pickLocale(req.headers.get("accept-language"), region);

  const mustSetRegion = !req.cookies.get("nw_region");
  const mustSetLocale = !req.cookies.get("nw_locale");

  let res: NextResponse;

  // 2) Din skyddade-routes-redirect (med cookies medskickade även om de nyss genererats)
  if (isProtectedPath(pathname)) {
    const existsUrl = new URL("/api/profile/exists", req.nextUrl.origin);

    const existingCookie = req.headers.get("cookie") ?? "";
    const extra: string[] = [];
    if (mustSetUid) extra.push(`nw_uid=${uid}`);
    if (mustSetRegion) extra.push(`nw_region=${region}`);
    if (mustSetLocale) extra.push(`nw_locale=${locale}`);
    const cookieHeader = [existingCookie, ...extra].filter(Boolean).join("; ");

    const existsRes = await fetch(existsUrl, { headers: { cookie: cookieHeader } }).catch(() => null);

    let hasProfile = false;
    if (existsRes?.ok) {
      try {
        const j = (await existsRes.json()) as { ok?: boolean; hasProfile?: boolean };
        hasProfile = !!j?.ok && !!j?.hasProfile;
      } catch {
        hasProfile = false;
      }
    }

    if (!hasProfile) {
      const redirectUrl = new URL("/onboarding", req.nextUrl.origin);
      redirectUrl.searchParams.set("next", pathname + search);
      res = NextResponse.redirect(redirectUrl);
    } else {
      res = NextResponse.next();
    }
  } else {
    res = NextResponse.next();
  }

  // 3) Sätt kakorna på svaret om de saknades
  if (mustSetUid) {
    res.cookies.set("nw_uid", uid, {
      path: "/",
      httpOnly: false, // klienten kan läsa (behövs för din banner/check)
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  if (mustSetRegion) {
    res.cookies.set("nw_region", region, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  if (mustSetLocale) {
    res.cookies.set("nw_locale", locale, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}

// Behåll din matcher (skippar _next/, api/session/init, favicon)
export const config = { matcher: ["/((?!_next/|api/session/init|favicon.ico).*)"] };
