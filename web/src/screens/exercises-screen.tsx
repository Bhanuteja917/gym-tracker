'use client';

import { ChevronRight, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { ExerciseFormDialog } from '@/components/exercise-form-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { MuscleFigure, MuscleSprite, MuscleThumb } from '@/components/muscle-figure/muscle-figure';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { muscleGroupsFrom } from '@/local/mutations';
import { useLocalQuery } from '@/local/provider';
import { listExercises } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';
import {
  groupOf,
  isMuscleId,
  isPartId,
  MUSCLES,
  muscleLabel,
  musclesFor,
  partsOf,
  sideFor,
  summarize,
  type MuscleId,
  type PartId,
} from '@/lib/muscles';
import { cn } from '@/lib/utils';

type Filters = { muscle: string | null; showArchived: boolean };

export function ExercisesScreen({ muscle: muscleParam, showArchived }: Filters) {
  const all = useLocalQuery(listExercises, []);

  if (all === undefined) {
    return (
      <>
        <PageHeader title="Exercises" />
        <ListSkeleton rows={8} className="h-12" />
      </>
    );
  }

  // The filter is a whole group ("chest") or one muscle in it ("upper-chest").
  const muscle: MuscleId | PartId | null = isMuscleId(muscleParam) || isPartId(muscleParam) ? muscleParam : null;
  const group = muscle && groupOf(muscle);
  const visible = all
    .filter((e) => e.archived === showArchived)
    .map((e) => ({ ...e, muscles: musclesFor(e.muscleGroup, e.name) }));
  const targets = (id: MuscleId | PartId) => {
    const parts = partsOf(id);
    return visible.filter((e) => e.muscles.some((m) => parts.includes(m)));
  };
  // For one muscle, exercises aimed at it come before ones for its whole group.
  const inGroup = (e: (typeof visible)[number]) => e.muscles.filter((m) => groupOf(m) === group).length;
  const exercises = !muscle
    ? visible
    : muscle === group
      ? targets(muscle)
      : targets(muscle).sort((a, b) => inGroup(a) - inGroup(b));
  const chips = (ids: readonly (MuscleId | PartId)[]) =>
    ids.map((id) => ({ id, label: muscleLabel(id), count: targets(id).length })).filter((c) => c.count > 0);
  const groups = chips(MUSCLES.map((m) => m.id));
  const parts = group && partsOf(group).length > 1 ? chips(partsOf(group)) : [];
  const href = (patch: Partial<Filters>) => {
    const next = { muscle, showArchived, ...patch };
    const q = new URLSearchParams();
    if (next.muscle) q.set('muscle', next.muscle);
    if (next.showArchived) q.set('archived', '1');
    const s = q.toString();
    return s ? `/exercises?${s}` : '/exercises';
  };
  // Tapping the figure picks the muscle's group first, then the muscle itself;
  // tapping the picked muscle again goes back up a level.
  const pick = (part: PartId) => {
    const next = groupOf(part) !== group ? groupOf(part) : part === muscle ? (part === group ? null : group) : part;
    navigate(href({ muscle: next }), { replace: true });
  };

  return (
    <>
      <PageHeader
        title={showArchived ? 'Archived' : 'Exercises'}
        actions={
          <ExerciseFormDialog
            muscleGroups={muscleGroupsFrom(all)}
            trigger={
              <Button size="icon" aria-label="New exercise">
                <Plus />
              </Button>
            }
          />
        }
      />

      {visible.length > 0 && (
        <>
          <section aria-label="Body map" className="bg-card mb-3 flex items-stretch gap-3 rounded-2xl border p-3">
            <MuscleFigure highlighted={muscle ? partsOf(muscle) : []} onSelect={pick} className="h-40 w-40 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
              <div>
                <p className="text-muted-foreground truncate text-xs">
                  {muscle ? (muscle === group ? 'Showing exercises for' : muscleLabel(group!)) : 'Showing'}
                </p>
                <p className={cn('mt-0.5 truncate text-xl font-bold', muscle && 'text-[#c2364f] dark:text-[#e8657f]')}>
                  {muscle ? muscleLabel(muscle) : 'All exercises'}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {exercises.length} in your {showArchived ? 'archive' : 'library'}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">Tap a muscle to filter</p>
            </div>
          </section>

          <ChipRow
            label="Muscle group"
            chips={groups}
            selected={group}
            all={{ label: 'All', href: href({ muscle: null }) }}
            href={(id) => href({ muscle: id })}
          />
          {parts.length > 0 && (
            <ChipRow
              label={`${muscleLabel(group!)} muscles`}
              chips={parts}
              selected={muscle === group ? null : muscle}
              all={{
                label: `All ${muscleLabel(group!).toLowerCase()}`,
                href: href({ muscle: group }),
              }}
              href={(id) => href({ muscle: id })}
            />
          )}
        </>
      )}

      {exercises.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {muscle ? (
            `No exercises target ${muscleLabel(muscle).toLowerCase()}.`
          ) : showArchived ? (
            'No archived exercises.'
          ) : (
            <>
              No exercises yet. Add one with +, or{' '}
              <AppLink href="/settings" className="underline">
                add the exercise library in Settings
              </AppLink>
              .
            </>
          )}
        </p>
      ) : (
        <>
          <MuscleSprite />
          <ul className="bg-card divide-y rounded-2xl border">
            {exercises.map((e) => (
              <li key={e.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_64px]">
                <AppLink href={`/exercise?id=${e.id}`} className="active:bg-accent flex items-center gap-3 px-4 py-2">
                  <MuscleThumb
                    side={sideFor(muscle ? partsOf(muscle) : e.muscles)}
                    highlighted={e.muscles}
                    className="h-12 w-6 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.name}</span>
                    {e.muscleGroup && (
                      <span className="text-muted-foreground block truncate text-sm">
                        {e.muscles.length ? summarize(e.muscles).map(muscleLabel).join(', ') : e.muscleGroup}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </AppLink>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-4 text-center">
        <AppLink href={href({ showArchived: !showArchived, muscle: null })} className="text-muted-foreground text-sm">
          {showArchived ? 'Back to exercises' : 'Show archived'}
        </AppLink>
      </div>
    </>
  );
}

function ChipRow<Id extends string>({
  label,
  chips,
  selected,
  all,
  href,
}: {
  label: string;
  chips: readonly { id: Id; label: string }[];
  selected: Id | null;
  all: { label: string; href: string };
  href: (id: Id) => string;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  return (
    <div ref={row} role="group" aria-label={label} className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
      {[{ id: null, label: all.label }, ...chips].map((c) => (
        <AppLink
          key={c.id ?? 'all'}
          href={c.id ? href(c.id) : all.href}
          aria-current={c.id === selected ? 'true' : undefined}
          className={cn(
            'flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm',
            c.id === selected ? 'border-[#e8657f] bg-[#e8657f] font-semibold text-[#0a0a0a]' : 'bg-card',
          )}
        >
          {c.label}
        </AppLink>
      ))}
    </div>
  );
}
