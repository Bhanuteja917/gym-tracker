'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const MIN_PASSWORD = 10;

/** Better Auth error codes → messages a person can act on. */
function describe(error: { code?: string; message?: string; status?: number }): string {
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'Wrong email or password.';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'An account with this email already exists. Sign in instead.';
    case 'PASSWORD_TOO_SHORT':
      return `Use at least ${MIN_PASSWORD} characters.`;
    case 'INVALID_EMAIL':
      return 'Enter a valid email address.';
  }
  if (error.status === 403) return 'This account is not allowed to use this app.';
  if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
  return error.message || 'Something went wrong. Try again.';
}

export function PasswordForm() {
  const id = useId();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signingUp = mode === 'sign-up';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (signingUp && password.length < MIN_PASSWORD) {
      return setError(`Use at least ${MIN_PASSWORD} characters.`);
    }
    setPending(true);
    const { error } = signingUp
      ? await authClient.signUp.email({ name: name.trim() || email.split('@')[0]!, email, password })
      : await authClient.signIn.email({ email, password, rememberMe: true });
    if (error) {
      setError(describe(error));
      setPending(false);
      return;
    }
    // Full load so every server component renders with the new session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/');
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="bg-muted grid grid-cols-2 rounded-lg p-1 text-sm font-medium">
        {(['sign-in', 'sign-up'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn('rounded-md py-1.5', mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground')}
          >
            {m === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {signingUp && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete={signingUp ? 'email' : 'username'}
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-password`}>Password</Label>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            required
            minLength={signingUp ? MIN_PASSWORD : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          {signingUp && <p className="text-muted-foreground text-xs">At least {MIN_PASSWORD} characters.</p>}
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
          {pending && <Spinner />}
          {signingUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
