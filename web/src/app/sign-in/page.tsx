import { Dumbbell } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { enabledProviders } from '@/server/auth';

import { DeviceNotice } from './device-notice';
import { PasswordForm } from './password-form';
import { SignInButtons, SignInError } from './sign-in-buttons';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  const providers = (['google', 'apple'] as const).filter((p) => enabledProviders[p]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
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

      <DeviceNotice />

      <PasswordForm />

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
      <SignInButtons providers={providers} />
    </main>
  );
}
