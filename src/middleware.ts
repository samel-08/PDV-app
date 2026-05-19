import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionJwt } from "@/lib/auth-session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif)$/i)
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/logout")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("pdv_session")?.value;
  const ok = await verifySessionJwt(token);

  if (pathname.startsWith("/api/")) {
    if (!ok) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (ok) {
      const u = req.nextUrl.clone();
      u.pathname = "/";
      return NextResponse.redirect(u);
    }
    return NextResponse.next();
  }

  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
