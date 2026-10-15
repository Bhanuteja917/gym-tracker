import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { auth } from './auth';

export type CurrentUser = { id: string; name: string; email: string; image: string | null };

/** The signed-in user, or null. Validates the session; deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
});

/**
 * The signed-in user, or a redirect to /sign-in. Every page and Server Action
 * that touches user data calls this; the proxy's cookie check is only a hint.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  return user;
}
