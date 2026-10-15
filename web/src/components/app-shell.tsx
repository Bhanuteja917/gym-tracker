'use client';

import { CloudOff, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { ListSkeleton } from '@/components/list-skeleton';
import { SyncStatus } from '@/components/sync-status';
import { TabBar } from '@/components/tab-bar';
import { Button } from '@/components/ui/button';
import { LocalDataProvider, useBoot } from '@/local/provider';
import { useLocation } from '@/local/router';
import { ExerciseScreen } from '@/screens/exercise-screen';
import { ExercisesScreen } from '@/screens/exercises-screen';
import { HistoryScreen } from '@/screens/history-screen';
import { HomeScreen } from '@/screens/home-screen';
import { SettingsScreen } from '@/screens/settings/settings-screen';
import { WorkoutScreen } from '@/screens/workout-screen';

const TITLES: Record<string, string> = {
  '/': 'Workout',
  '/workout': 'Workout',
  '/history': 'History',
  '/exercises': 'Exercises',
  '/exercise': 'Exercise',
  '/settings': 'Settings',
};

/** The signed-in app: screens chosen from the URL, data from the on-device database. */
export function AppShell() {
  return (
    <LocalDataProvider>
      <Shell />
    </LocalDataProvider>
  );
}

function Shell() {
  const location = useLocation();
  const { state, retry } = useBoot();
  const pathname = location?.pathname ?? null;

  useEffect(() => {
    if (pathname) document.title = `${TITLES[pathname] ?? 'Gym Tracker'} · Gym Tracker`;
  }, [pathname]);

  let content;
  if (!location || state.status === 'loading') {
    content = <ListSkeleton rows={3} className="mt-16 h-24" />;
  } else if (state.status === 'offline') {
    content = (
      <Notice
        title="You’re offline"
        text="Connect to the internet once to sign in and download your workouts. After that, the app works without a connection."
        onRetry={retry}
      />
    );
  } else if (state.status === 'error') {
    content = <Notice title="Couldn’t load your data" text="The server didn’t respond. Try again in a moment." onRetry={retry} />;
  } else {
    content = <Screen pathname={location.pathname} params={location.params} />;
  }

  return (
    <>
      {state.status === 'ready' && <SyncStatus />}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+5rem)]">
        {content}
      </main>
      <TabBar pathname={pathname} />
    </>
  );
}

function Screen({ pathname, params }: { pathname: string; params: URLSearchParams }) {
  const id = params.get('id') ?? '';
  switch (pathname) {
    case '/':
      return <HomeScreen />;
    case '/workout':
      return <WorkoutScreen key={id} id={id} />;
    case '/history':
      return <HistoryScreen />;
    case '/exercises':
      return <ExercisesScreen muscle={params.get('muscle')} showArchived={params.get('archived') === '1'} />;
    case '/exercise':
      return <ExerciseScreen key={id} id={id} />;
    case '/settings':
      return <SettingsScreen />;
    default:
      return <Notice title="Page not found" text="This page doesn’t exist." />;
  }
}

function Notice({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 pt-24 text-center">
      <CloudOff className="text-muted-foreground size-10" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{text}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}
