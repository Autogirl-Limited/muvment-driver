import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_ROUTES = [
  "/login",
  "/reset-password",
  "/verify-code",
  "/create-password",
  "/become-driver",
  "/bd-success",
];

const ALWAYS_PUBLIC = ["/", "/privacy-policy", "/terms-of-use", "/~offline"];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth?.accessToken) && !request.auth?.error;

  if (ALWAYS_PUBLIC.includes(pathname)) {
    return NextResponse.next();
  }

  const isAuthRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAuthRoute) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/home", request.nextUrl.origin));
    }

    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.nextUrl.origin);

    if (pathname !== "/home") {
      loginUrl.searchParams.set("next", pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except Next internals, static files, the service worker and the auth API.
    "/((?!api/auth|api/mock|_next/static|_next/image|icons|brand|favicon.png|manifest.webmanifest|sw.js|swe-worker.*|workbox-.*).*)",
  ],
};
