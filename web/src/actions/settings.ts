'use server';

import { InvalidBackupError, parseExpoBackup } from '@/lib/backup';
import { importExpoBackup } from '@/server/import';
import { getCurrentUser } from '@/server/session';

import { attempt, type ActionResult } from './result';

const MAX_BACKUP_BYTES = 4 * 1024 * 1024;

/**
 * Imports an Expo app backup on the server (it needs a connection); devices
 * download the new workouts on their next sync.
 */
export async function importBackupAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in again to import' } satisfies ActionResult;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a backup file' } satisfies ActionResult;
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'File is too large (max 4 MB)' } satisfies ActionResult;
  }
  let backup;
  try {
    backup = parseExpoBackup(await file.text());
  } catch (error) {
    if (error instanceof InvalidBackupError) {
      return { ok: false, error: error.message } satisfies ActionResult;
    }
    throw error;
  }
  return attempt(() => importExpoBackup(user.id, backup));
}
