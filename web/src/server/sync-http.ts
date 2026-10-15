import 'server-only';

import { NextResponse } from 'next/server';

import { auth } from './auth';

/** JSON response that no cache (browser, service worker, CDN) may keep. */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * The signed-in user's id for a sync request, or an error response. The session
 * is validated against the database on every request; nothing cached on the
 * device is trusted. Cross-site requests are refused (cookies are SameSite=Lax,
 * this is a second check).
 */
export async function syncUser(request: Request): Promise<{ userId: string } | { error: NextResponse }> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return { error: json({ error: 'Cross-site request refused' }, 403) };
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: json({ error: 'Sign in to sync' }, 401) };
  return { userId: session.user.id };
}
