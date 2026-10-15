import { WifiOff } from 'lucide-react';
import type { Metadata } from 'next';

import { ReloadButton } from './reload-button';

export const metadata: Metadata = { title: 'Offline' };

/** Shown by the service worker for a page it doesn't keep offline. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="text-muted-foreground size-10" />
      <h1 className="text-xl font-semibold">You’re offline</h1>
      <p className="text-muted-foreground text-sm">
        This page needs a connection. Your workouts, history and exercises work offline from the Gym Tracker home screen.
      </p>
      <ReloadButton />
    </main>
  );
}
