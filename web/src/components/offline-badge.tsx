'use client';

import { WifiOff } from 'lucide-react';
import { useOffline } from 'next/offline';

/** A small pill shown while the app has no connection. */
export function OfflineBadge() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="bg-foreground text-background fixed top-[calc(env(safe-area-inset-top)+0.5rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow"
    >
      <WifiOff className="size-3.5" /> Offline
    </div>
  );
}
