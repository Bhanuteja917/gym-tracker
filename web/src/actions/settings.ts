'use server';

import { refresh } from 'next/cache';

import { InvalidBackupError, parseExpoBackup } from '@/lib/backup';
import { unitSchema } from '@/lib/validation';
import { importExpoBackup } from '@/server/import';
import { requireUser } from '@/server/session';
import { setDefaultUnit } from '@/server/settings';

import { attempt, type ActionResult } from './result';

export async function setDefaultUnitAction(unit: unknown) {
  const user = await requireUser();
  const result = await attempt(() => setDefaultUnit(user.id, unitSchema.parse(unit)));
  refresh();
  return result;
}

const MAX_BACKUP_BYTES = 4 * 1024 * 1024;

export async function importBackupAction(formData: FormData) {
  const user = await requireUser();
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
  const result = await attempt(() => importExpoBackup(user.id, backup));
  refresh();
  return result;
}
