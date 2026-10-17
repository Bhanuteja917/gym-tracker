'use client';

import { CalendarDays, Dumbbell, History, ListChecks, Settings } from 'lucide-react';

import { AppLink } from '@/local/router';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Workout', icon: Dumbbell, match: (p: string) => p === '/' || p === '/workout' },
  { href: '/plan', label: 'Plan', icon: CalendarDays, match: (p: string) => p.startsWith('/plan') },
  { href: '/history', label: 'History', icon: History, match: (p: string) => p === '/history' },
  { href: '/exercises', label: 'Exercises', icon: ListChecks, match: (p: string) => p.startsWith('/exercise') },
  { href: '/settings', label: 'Settings', icon: Settings, match: (p: string) => p === '/settings' },
];

/** The tab bar; until the URL is known (prerendered shell) no tab is highlighted. */
export function TabBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = pathname !== null && match(pathname);
          return (
            <li key={href}>
              <AppLink
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium select-none',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </AppLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
