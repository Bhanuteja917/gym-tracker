'use client';

import { ChevronRight, LayoutTemplate } from 'lucide-react';

import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { PlanTemplates } from '@/components/plan/plan-templates';
import { Button } from '@/components/ui/button';
import { useLocalQuery } from '@/local/provider';
import { getSettings, listExercises } from '@/local/queries';
import { AppLink } from '@/local/router';
import { groupOf, type MuscleId, muscleLabel, musclesFor } from '@/lib/muscles';
import { dayName, WEEKDAY_LABELS, WEEKDAYS, weekdayOf, type WeeklyPlan } from '@/lib/plan';
import { cn } from '@/lib/utils';

/** The week, Monday to Sunday: what to train each day. */
export function PlanScreen() {
  const settings = useLocalQuery(getSettings, []);
  const exercises = useLocalQuery(listExercises, []);
  const today = weekdayOf(new Date());

  if (!settings || !exercises) return <ListSkeleton rows={7} />;
  const plan = settings.weeklyPlan;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const empty = WEEKDAYS.every((d) => plan[d].items.length === 0);

  return (
    <>
      <PageHeader
        title="Plan"
        subtitle="What to train each day of the week"
        actions={
          <PlanTemplates
            trigger={
              <Button variant="outline" size="sm">
                <LayoutTemplate /> Templates
              </Button>
            }
          />
        }
      />
      {empty && (
        <div className="bg-muted/50 mb-4 rounded-xl p-4 text-sm">
          <p className="font-medium">No plan yet</p>
          <p className="text-muted-foreground mt-1">
            Tap a day to choose its exercises, or start from a template. The Workout tab then offers today’s plan.
          </p>
        </div>
      )}
      <ul className="space-y-2">
        {WEEKDAYS.map((day) => {
          const value = plan[day];
          const names = value.items.map((i) => byId.get(i.exerciseId)).filter((e) => e !== undefined);
          const sets = value.items.reduce((n, i) => n + i.sets, 0);
          return (
            <li key={day}>
              <AppLink
                href={`/plan/day?day=${day}`}
                className={cn(
                  'bg-card active:bg-accent flex items-center gap-3 rounded-xl border p-4',
                  day === today && 'border-primary',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {WEEKDAY_LABELS[day]}
                    {day === today && ' · Today'}
                  </p>
                  <p className={cn('font-semibold', value.items.length === 0 && 'text-muted-foreground')}>
                    {dayName(value)}
                  </p>
                  {names.length > 0 && (
                    <p className="text-muted-foreground truncate text-sm">
                      {names.length} exercises · {sets} sets · {names.map((e) => e.name).join(', ')}
                    </p>
                  )}
                </div>
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </AppLink>
            </li>
          );
        })}
      </ul>
      {settings.planTemplates.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="font-semibold">Your templates</h2>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {settings.planTemplates.map((t) => (
              <li key={t.id}>
                <AppLink
                  href={`/plan/template?id=${t.id}`}
                  className="active:bg-accent flex items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1">
                    {WEEKDAYS.filter((d) => t.days[d].items.length > 0).length} days
                    <ChevronRight className="size-4" />
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!empty && <WeeklyVolume plan={plan} exercises={exercises} />}
    </>
  );
}

/** Planned sets per muscle group for the week, so gaps and overlaps stand out. */
function WeeklyVolume({
  plan,
  exercises,
}: {
  plan: WeeklyPlan;
  exercises: readonly { id: string; name: string; muscleGroup: string | null }[];
}) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const totals = new Map<MuscleId, number>();
  for (const day of WEEKDAYS) {
    for (const item of plan[day].items) {
      const exercise = byId.get(item.exerciseId);
      if (!exercise) continue;
      // Count each muscle group the exercise is tagged with once.
      const groups = new Set(musclesFor(exercise.muscleGroup, exercise.name).map(groupOf));
      for (const g of groups) totals.set(g, (totals.get(g) ?? 0) + item.sets);
    }
  }
  const rows = [...totals].sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  return (
    <section className="mt-6 space-y-2">
      <h2 className="font-semibold">Sets per week</h2>
      <p className="text-muted-foreground text-xs">
        Each exercise counts toward the muscles it’s tagged with. Most people grow well on about 10–20 hard sets per
        muscle a week, split over two or more days.
      </p>
      <ul className="bg-card divide-y rounded-xl border text-sm">
        {rows.map(([group, sets]) => (
          <li key={group} className="flex items-center justify-between px-4 py-2">
            <span>{muscleLabel(group)}</span>
            <span className={cn('tabular-nums', sets < 8 && 'text-muted-foreground')}>{sets}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
