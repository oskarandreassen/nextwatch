import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function newId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function middleware(req: NextRequest) {
  const uid = req.cookies.get("nw_uid")?.value;
  if (!uid) {
    const res = NextResponse.next();
    res.cookies.set("nw_uid", newId(), { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 60*60*24*365 });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)"]
};
