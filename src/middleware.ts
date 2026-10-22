import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight route guard. It only checks whether a NextAuth session cookie is
 * present, so no auth library (and no `jose`) is bundled into the Edge runtime.
 * Real validation happens on the client: `useSession` resolves the cookie, the
 * API client sends the bearer token, and <SessionTokenSync/> signs the driver
 * out when the token can no longer be refreshed.
 */
const PUBLIC_ROUTES = [
  "/login",
  "/reset-password",
  "/verify-code",
  "/create-password",
  "/become-driver",
  "/bd-success",
];

const ALWAYS_PUBLIC = ["/privacy-policy", "/terms-of-use", "/~offline"];

const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

const hasSessionCookie = (request: NextRequest) =>
  SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = hasSessionCookie(request);

  // The app's start URL. Decide on the server so the OS launch screen hands
  // straight to Home or Login with no in-app splash in between.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(isAuthenticated ? "/home" : "/login", request.nextUrl.origin));
  }

  if (ALWAYS_PUBLIC.includes(pathname)) {
    return NextResponse.next();
  }
  const isAuthRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAuthRoute) {
    return isAuthenticated
      ? NextResponse.redirect(new URL("/home", request.nextUrl.origin))
      : NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.nextUrl.origin);

    if (pathname !== "/home") {
      loginUrl.searchParams.set("next", pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, static files, the service worker and the API routes.
    "/((?!api/auth|api/mock|_next/static|_next/image|icons|brand|favicon.ico|favicon.svg|apple-touch-icon.png|manifest.webmanifest|sw.js|swe-worker.*|workbox-.*).*)",
  ],
};
