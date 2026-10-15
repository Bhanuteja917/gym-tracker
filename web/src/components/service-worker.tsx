'use client';

import { useEffect } from 'react';

/** Registers /sw.js in production builds. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error) => {
      console.error('Service worker registration failed', error);
    });
  }, []);
  return null;
}
