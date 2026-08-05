import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// The (auth) route group — the only routes reachable without a session today. M20's fuller public
// surface (anonymous Company/Job browsing, docs/frontend-architecture/09-navigation-architecture.md
// `(public)` route group) is page-implementation scope this milestone deliberately does not build
// (see docs/interaction-framework/14-risks-and-future-expansion.md) — the existing scaffold's
// jobs/applications/billing pages already live under the authenticated (dashboard) group, and this
// middleware reflects that real, current routing rather than a not-yet-built future one.
// M27.5: `/pricing` is the product's first standalone marketing page — real, public, unauthenticated
// (Merchant-of-record checkout still requires an account; this page only presents pricing and
// routes a visitor to /register to start one).
const PUBLIC_PREFIXES = ['/login', '/register', '/verify-email', '/forgot-password', '/pricing'];

/**
 * Coarse authenticated/anonymous redirect only — this is a UX courtesy, not a security boundary
 * (docs/frontend-architecture/09-navigation-architecture.md; docs/frontend-architecture/12-
 * architecture-decision-records.md ADR-003). The cookie it reads is a non-httpOnly marker set by
 * lib/stores/auth-store.ts alongside the real session, never the access token itself — real
 * authorization is always the Bearer token validated server-side on every API call
 * (docs/frontend-architecture/08-permission-matrix.md "hidden ≠ secured"). The real, fine-grained
 * check (decoding the token, redirecting on a missing/expired session) happens client-side in
 * components/shell/app-shell.tsx, which has access to the actual auth store this Edge-runtime
 * middleware does not.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPublic) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('gje_session');
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Fixed in Milestone 22.2's self-review: the original matcher only excluded Next.js internals,
  // meaning an anonymous crawler requesting /robots.txt, /sitemap.xml, or any other well-known
  // static file was incorrectly redirected to /login instead of receiving that file (or a real
  // 404). Excludes any path with a file extension in addition to Next.js internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)'],
};
