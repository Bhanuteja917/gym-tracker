'use client';

import { AlertCircle, Check, CloudOff, LogIn, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/use-hydrated';
import { describeChange } from '@/local/describe';
import { reapplyConflict } from '@/local/mutations';
import { useLocal, useLocalQuery, useQueueCounts, useSyncState } from '@/local/provider';
import { discardFailed, retryFailed, type SyncState } from '@/local/sync-engine';
import { formatDay, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

function statusLine(state: SyncState, pending: number): { icon: typeof Check; text: string; tone?: 'warn' } {
  const saved = `${pending} ${pending === 1 ? 'change is' : 'changes are'} saved on this device`;
  switch (state.problem) {
    case 'offline':
      return {
        icon: CloudOff,
        text: pending ? `Offline. ${saved} and will sync when you’re back online.` : 'Offline. Everything is saved on this device.',
      };
    case 'auth':
      return { icon: LogIn, text: `Your session has ended. Sign in to sync.${pending ? ` ${saved}.` : ''}`, tone: 'warn' };
    case 'account':
      return { icon: AlertCircle, text: 'A different account is signed in on this device.', tone: 'warn' };
    case 'update':
      return { icon: AlertCircle, text: 'This version of the app is too old to sync. Close and reopen it to update.', tone: 'warn' };
    case 'server':
      return { icon: AlertCircle, text: `The server had a problem. Retrying automatically.${pending ? ` ${saved}.` : ''}`, tone: 'warn' };
    case null:
      if (state.syncing) return { icon: RefreshCw, text: 'Syncing…' };
      if (pending) return { icon: RefreshCw, text: `${saved}. Syncing shortly.` };
      return { icon: Check, text: 'Everything is synced.' };
  }
}

export function SyncPanel() {
  const { db, engine, mutate } = useLocal();
  const state = useSyncState();
  const counts = useQueueCounts();
  const failed = useLocalQuery((d) => d.outbox.where('status').equals('failed').toArray(), []);
  const conflicts = useLocalQuery((d) => d.conflicts.toArray(), []);
  const hydrated = useHydrated();
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  if (!counts || !failed || !conflicts) return null;
  const line = statusLine(state, counts.pending);
  const Icon = line.icon;

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      engine.schedule(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 size-4 shrink-0', state.syncing && 'animate-spin', line.tone === 'warn' && 'text-amber-600')} />
        <div className="flex-1">
          <p>{line.text}</p>
          {hydrated && state.lastSyncAt && (
            <p className="text-muted-foreground text-xs">
              Last synced {formatDay(state.lastSyncAt).toLowerCase()} at {formatTime(state.lastSyncAt)}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {state.problem === 'auth' ? (
          <Button asChild className="flex-1">
            <a href="/sign-in">
              <LogIn /> Sign in
            </a>
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" disabled={state.syncing} onClick={() => void engine.sync()}>
            <RefreshCw className={cn(state.syncing && 'animate-spin')} /> Sync now
          </Button>
        )}
      </div>

      {failed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Couldn’t sync</h3>
          <ul className="divide-y rounded-lg border">
            {failed.map((entry) => (
              <li key={entry.seq} className="space-y-2 p-3">
                <div>
                  <div className="font-medium">
                    {entry.op === 'delete' ? 'Delete: ' : ''}
                    {describeChange(entry.entity, entry.data as Record<string, unknown>)}
                  </div>
                  <div className="text-destructive text-xs">{entry.error}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => act(() => retryFailed(db, entry.seq))}>
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      confirm('Discard this change? The server’s version will be kept.') &&
                      act(() => discardFailed(db, entry.seq!))
                    }
                  >
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Changes not applied</h3>
          <p className="text-muted-foreground text-xs">
            These were changed or deleted on another device before this one synced. The other device’s version was kept.
          </p>
          <ul className="divide-y rounded-lg border">
            {conflicts.map((c) => (
              <li key={c.id} className="space-y-2 p-3">
                <div>
                  <div className="font-medium">
                    {describeChange(c.entity, (c.local ?? c.server) as Record<string, unknown>)}
                  </div>
                  <div className="text-muted-foreground text-xs">{c.message}</div>
                  {c.local !== null && c.server !== null && c.entity === 'set' && (
                    <div className="text-muted-foreground text-xs">
                      Kept: {describeChange('set', c.server as unknown as Record<string, unknown>).replace('Set: ', '')}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {c.local !== null && c.server !== null && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        act(async () => {
                          const result = await mutate((d) => reapplyConflict(d, c.id!));
                          if (!result.ok) throw new Error(result.error);
                        })
                      }
                    >
                      Use mine
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => act(() => db.conflicts.delete(c.id!))}>
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {counts.pending > 0 && (
        <p className="text-muted-foreground text-xs">
          Don’t remove the app from your Home Screen until this syncs: that deletes data saved on this device.
        </p>
      )}
      {persisted === false && (
        <p className="text-muted-foreground text-xs">
          Your browser may clear this device’s copy if the app goes unused for a long time. Synced data is safe on the server.
        </p>
      )}
    </div>
  );
}
