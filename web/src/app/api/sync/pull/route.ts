import { cursorSchema, pullChanges } from '@/server/sync';
import { json, syncUser } from '@/server/sync-http';

/** The signed-in user's changes since `?cursor=` (0 or absent = everything). */
export async function GET(request: Request) {
  const auth = await syncUser(request);
  if ('error' in auth) return auth.error;

  const cursor = cursorSchema.safeParse(new URL(request.url).searchParams.get('cursor') ?? '0');
  if (!cursor.success) return json({ error: 'Invalid cursor' }, 400);
  return json(await pullChanges(auth.userId, cursor.data));
}
