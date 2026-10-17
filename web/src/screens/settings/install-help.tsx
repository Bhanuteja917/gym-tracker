'use client';

import { Share, SquarePlus } from 'lucide-react';

import { useHydrated } from '@/hooks/use-hydrated';

/** "Add to Home Screen" steps, shown in a browser tab but not in the installed app. */
export function InstallHelp() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return (
    <section className="bg-card space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold">Install the app</h2>
      {ios ? (
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          <li>
            In Safari, tap Share <Share className="inline size-4 align-text-bottom" />.
          </li>
          <li>
            Tap <span className="text-foreground font-medium">Add to Home Screen</span>{' '}
            <SquarePlus className="inline size-4 align-text-bottom" />.
          </li>
          <li>Open SetStack from your Home Screen. It runs full screen, like an app.</li>
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">
          Use your browser’s “Install app” or “Add to Home Screen” option to open SetStack in its own window.
        </p>
      )}
    </section>
  );
}
