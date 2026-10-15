'use client';

import { useLocal } from '@/local/provider';

import { AttendanceSetting } from './attendance-setting';
import { ExerciseLibrary } from './exercise-library';
import { ImportBackup } from './import-backup';
import { InstallHelp } from './install-help';
import { SignOutButton } from './sign-out-button';
import { SyncPanel } from './sync-panel';
import { UnitSetting } from './unit-setting';
import { PageHeader } from '@/components/page-header';

export function SettingsScreen() {
  const { account } = useLocal();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Section id="sync" title="Sync">
          <SyncPanel />
        </Section>

        <Section title="Units" description="New sets start in this unit. Each set keeps the unit it was logged in.">
          <UnitSetting />
        </Section>

        <Section
          title="Attendance grid"
          description="The dots on the Workout tab: one per day you finished a workout. Set a start date to track a fixed 3 or 6 month stretch."
        >
          <AttendanceSetting />
        </Section>

        <Section
          title="Exercise library"
          description="Adds about 870 common exercises from free-exercise-db, each tagged with the muscle it targets. Exercises you already have (same name) are skipped, so it's safe to run again. Needs a connection."
        >
          <ExerciseLibrary />
        </Section>

        <Section
          title="Import from the iPhone app"
          description="In the Gym Tracker iPhone app, go to Settings → Export backup (JSON), then choose the .json file here. Exercises are matched by name; workouts already imported are skipped. Needs a connection."
        >
          <ImportBackup />
        </Section>

        <InstallHelp />

        <Section title="Account">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{account.name}</div>
              <div className="text-muted-foreground truncate">{account.email}</div>
            </div>
            <SignOutButton />
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-card scroll-mt-12 space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
      </div>
      {children}
    </section>
  );
}
