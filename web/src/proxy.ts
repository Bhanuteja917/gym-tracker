import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic redirect for signed-out visitors. This only checks that a session
 * cookie exists; pages and actions validate the session with requireUser().
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except auth endpoints, the sign-in and offline pages, Next
  // internals, and public PWA files.
  matcher: [
    '/((?!api/auth|sign-in|offline|_next/|manifest\\.webmanifest|sw\\.js|icons/|favicon\\.ico|apple-icon|icon).*)',
  ],
};
