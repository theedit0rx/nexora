import { NextResponse, type NextRequest } from "next/server";

/* ==========================================================================
   NEXORA — Route protection
   The middleware only checks for the presence of a valid-shaped session
   cookie. Authorisation is enforced server-side in every route handler and
   server component — the browser is never trusted for permissions.
   ========================================================================== */

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/demo", "/api/auth/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/generated/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("nexora_session")?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.txt|.*\\.xml).*)"],
};
