import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/server/session';
import { getDefaultUnit } from '@/server/settings';

import { ImportBackup } from './import-backup';
import { InstallHelp } from './install-help';
import { SignOutButton } from './sign-out-button';
import { UnitSetting } from './unit-setting';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const user = await requireUser();
  const unit = await getDefaultUnit(user.id);
  return (
    <div className="space-y-6">
      <Section title="Units" description="New sets start in this unit. Each set keeps the unit it was logged in.">
        <UnitSetting unit={unit} />
      </Section>

      <Section
        title="Import from the iPhone app"
        description="In the Gym Tracker iPhone app, go to Settings → Export backup (JSON), then choose the .json file here. Exercises are matched by name; workouts already imported are skipped."
      >
        <ImportBackup />
      </Section>

      <InstallHelp />

      <Section title="Account">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <div className="truncate font-medium">{user.name}</div>
            <div className="text-muted-foreground truncate">{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
      </div>
      {children}
    </section>
  );
}
