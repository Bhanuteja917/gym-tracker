import { Dumbbell } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { enabledProviders } from '@/server/auth';

import { SignInButtons, SignInError } from './sign-in-buttons';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  const providers = (['google', 'apple'] as const).filter((p) => enabledProviders[p]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl">
          <Dumbbell className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold">Gym Tracker</h1>
        <p className="text-muted-foreground text-sm">Log your workouts and see your progress.</p>
      </div>

      <Suspense>
        <SignInError />
      </Suspense>

      {providers.length > 0 ? (
        <SignInButtons providers={providers} />
      ) : (
        <p className="text-muted-foreground rounded-lg border p-4 text-sm">
          No sign-in provider is configured. Set <code>GOOGLE_CLIENT_ID</code> and{' '}
          <code>GOOGLE_CLIENT_SECRET</code> (or the Apple variables) and restart.
        </p>
      )}
    </main>
  );
}
