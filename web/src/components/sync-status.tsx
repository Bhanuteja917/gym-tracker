'use client';

import { AlertCircle, CloudOff, LogIn, RefreshCw } from 'lucide-react';

import { type QueueCounts, useQueueCounts, useSyncState } from '@/local/provider';
import { AppLink } from '@/local/router';
import type { SyncState } from '@/local/sync-engine';
import { cn } from '@/lib/utils';

type Pill = { text: string; icon: typeof CloudOff; tone: 'muted' | 'warn' | 'error'; href: string; spin?: boolean };

/** What the status pill says, or null when everything is synced. Exported for tests. */
export function describeSync(state: SyncState, counts: QueueCounts): Pill | null {
  const pending = counts.pending > 0 ? `${counts.pending} pending` : null;
  if (state.problem === 'auth') return { text: 'Sign in to sync', icon: LogIn, tone: 'warn', href: '/sign-in' };
  if (state.problem === 'update') return { text: 'Update needed to sync', icon: AlertCircle, tone: 'warn', href: '/settings' };
  if (counts.failed > 0) {
    return { text: `${counts.failed} not synced · Review`, icon: AlertCircle, tone: 'error', href: '/settings' };
  }
  if (counts.conflicts > 0) {
    return { text: `${counts.conflicts} not applied · Review`, icon: AlertCircle, tone: 'warn', href: '/settings' };
  }
  if (state.problem === 'offline') {
    return { text: pending ? `Offline · ${pending}` : 'Offline', icon: CloudOff, tone: 'muted', href: '/settings' };
  }
  if (state.problem === 'server' && pending) {
    return { text: `Sync error · ${pending}`, icon: AlertCircle, tone: 'warn', href: '/settings' };
  }
  if (state.syncing && pending) return { text: 'Syncing…', icon: RefreshCw, tone: 'muted', href: '/settings', spin: true };
  // Pending with no problem means a sync is about to run (changes are batched for a moment).
  return null;
}

/** A small pill at the top while anything isn't synced. Tapping it opens Settings → Sync. */
export function SyncStatus() {
  const state = useSyncState();
  const counts = useQueueCounts();
  const pill = counts ? describeSync(state, counts) : null;
  if (!pill) return null;
  const Icon = pill.icon;
  const link = (
    <>
      <Icon className={cn('size-3.5', pill.spin && 'animate-spin')} /> {pill.text}
    </>
  );
  const className = cn(
    'fixed top-[calc(env(safe-area-inset-top)+0.5rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap shadow',
    pill.tone === 'muted' && 'bg-foreground text-background',
    pill.tone === 'warn' && 'bg-amber-500 text-black',
    pill.tone === 'error' && 'bg-destructive text-white',
  );
  return (
    <div role="status" aria-live="polite">
      {pill.href === '/sign-in' ? (
        // A full page load: sign-in is a separate page.
        <a href="/sign-in" className={className}>
          {link}
        </a>
      ) : (
        <AppLink href={`${pill.href}#sync`} className={className}>
          {link}
        </AppLink>
      )}
    </div>
  );
}
