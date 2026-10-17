'use client';

import { KeyRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { passkeysSupported, signInWithPasskey } from '@/lib/passkeys';

type Provider = 'google' | 'apple';
type Method = Provider | 'passkey';

const LABELS: Record<Provider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
};

export function SignInButtons({ providers }: { providers: Provider[] }) {
  const [pending, setPending] = useState<Method | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: '/',
      errorCallbackURL: '/sign-in',
    });
    // On success the browser is already navigating to the provider.
    if (error) {
      setError(error.message ?? 'Sign-in failed. Try again.');
      setPending(null);
    }
  }

  async function signInPasskey() {
    if (!passkeysSupported()) return setError('This browser doesn’t support passkeys.');
    setPending('passkey');
    setError(null);
    const result = await signInWithPasskey();
    if (result.signedIn) {
      // Full load so every server component renders with the new session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/');
      return;
    }
    setError(result.error);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        variant="outline"
        className="h-12 text-base"
        disabled={pending !== null}
        onClick={signInPasskey}
      >
        {pending === 'passkey' ? <Spinner /> : <KeyRound />}
        Sign in with a passkey
      </Button>
      {providers.map((provider) => (
        <Button
          key={provider}
          size="lg"
          variant={provider === 'apple' ? 'default' : 'outline'}
          className="h-12 text-base"
          disabled={pending !== null}
          onClick={() => signIn(provider)}
        >
          {pending === provider ? <Spinner /> : provider === 'google' ? <GoogleIcon /> : <AppleIcon />}
          {LABELS[provider]}
        </Button>
      ))}
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <p className="text-muted-foreground text-center text-xs">
        Sign in once with your password, then add a passkey in Settings to use Face ID or Touch ID.
      </p>
    </div>
  );
}

/** Shows the error Better Auth appends when an OAuth sign-in fails (?error=...). */
export function SignInError() {
  const error = useSearchParams().get('error');
  if (!error) return null;
  const message =
    error === 'access_denied'
      ? 'Sign-in was cancelled.'
      : /not allowed|forbidden|unable_to_create_user/i.test(error)
        ? 'This account is not allowed to use this app.'
        : 'Sign-in failed. Try again.';
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.2 6.14c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
    </svg>
  );
}
