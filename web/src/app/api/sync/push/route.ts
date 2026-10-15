import { pushRequestSchema, SYNC_PROTOCOL } from '@/lib/sync-protocol';
import { firstError } from '@/lib/validation';
import { applyPush } from '@/server/sync';
import { json, syncUser } from '@/server/sync-http';

const MAX_BODY_BYTES = 1024 * 1024;

/** Applies a batch of the device's queued changes. See docs/OFFLINE-PLAN.md. */
export async function POST(request: Request) {
  const auth = await syncUser(request);
  if ('error' in auth) return auth.error;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'Too many changes in one request' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const parsed = pushRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: firstError(parsed.error) }, 400);
  const { protocol, expectedUserId, mutations } = parsed.data;
  if (protocol !== SYNC_PROTOCOL && protocol !== SYNC_PROTOCOL - 1) {
    return json({ error: 'Update the app to sync' }, 426);
  }
  // The queue belongs to the account that made the changes; never apply it to another.
  if (expectedUserId !== auth.userId) return json({ error: 'Signed in as a different account' }, 409);

  return json({ results: await applyPush(auth.userId, mutations) });
}
