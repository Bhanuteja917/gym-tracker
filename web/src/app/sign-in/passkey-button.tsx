'use client';

import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { passkeysSupported, signInWithPasskey } from '@/lib/passkeys';

export function PasskeyButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!passkeysSupported()) return setError('This browser doesn’t support passkeys.');
    setPending(true);
    setError(null);
    const result = await signInWithPasskey();
    if (result.signedIn) {
      // Full load so every server component renders with the new session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/');
      return;
    }
    setError(result.error);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" variant="outline" className="h-12 text-base" disabled={pending} onClick={signIn}>
        {pending ? <Spinner /> : <KeyRound />}
        Sign in with a passkey
      </Button>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <p className="text-muted-foreground text-center text-xs">
        Sign in once with your password, then add a passkey in Settings to use Face ID or Touch ID.
      </p>
    </div>
  );
}
