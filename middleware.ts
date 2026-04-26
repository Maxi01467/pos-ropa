import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/auth-core";
import { canAccessPath } from "@/lib/core/permissions";

const PUBLIC_PATHS = new Set(["/login", "/offline"]);

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/@powersync/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icon-") ||
    pathname === "/apple-touch-icon.png" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
  );

  if (!session && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!session) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (session.role === "STAFF" && session.clientType !== "desktop") {
      return NextResponse.next();
    }

    const destination = session.role === "ADMIN" ? "/" : "/nueva-venta";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (session.role === "STAFF" && session.clientType !== "desktop") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.role === "STAFF" && pathname === "/") {
    return NextResponse.redirect(new URL("/nueva-venta", request.url));
  }

  if (!canAccessPath(session.role, pathname, { isDesktop: session.clientType === "desktop" })) {
    const destination = session.role === "ADMIN" ? "/" : "/nueva-venta";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
