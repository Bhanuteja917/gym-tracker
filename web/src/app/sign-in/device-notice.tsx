'use client';

import { CloudOff } from 'lucide-react';

import { useHydrated } from '@/hooks/use-hydrated';
import { getStoredAccount, getUnsyncedAccount } from '@/local/account';

/** Reminds whoever signs in that this device holds another sign-in's unsynced work. */
export function DeviceNotice() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const unsynced = getUnsyncedAccount();
  const stored = getStoredAccount();
  const text = unsynced
    ? `${unsynced.count} ${unsynced.count === 1 ? 'change' : 'changes'} from ${unsynced.email} haven’t synced yet. Sign in as ${unsynced.email} to sync them.`
    : stored
      ? `Sign in as ${stored.email} to sync the workouts saved on this device.`
      : null;
  if (!text) return null;
  return (
    <p role="status" className="bg-muted flex gap-2 rounded-lg p-3 text-sm">
      <CloudOff className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );
}
