'use client';

import { ChevronRight, Plus } from 'lucide-react';

import { ExerciseFormDialog } from '@/components/exercise-form-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { MuscleFigure, MuscleSprite, MuscleThumb } from '@/components/muscle-figure/muscle-figure';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { muscleGroupsFrom } from '@/local/mutations';
import { useLocalQuery } from '@/local/provider';
import { listExercises } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';
import { isMuscleId, MUSCLES, muscleLabel, musclesFor, sideFor, type MuscleId } from '@/lib/muscles';
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

  const muscle = isMuscleId(muscleParam) ? muscleParam : null;
  const visible = all
    .filter((e) => e.archived === showArchived)
    .map((e) => ({ ...e, muscles: musclesFor(e.muscleGroup) }));
  const exercises = muscle ? visible.filter((e) => e.muscles.includes(muscle)) : visible;
  const counts = MUSCLES.map((m) => ({ ...m, count: visible.filter((e) => e.muscles.includes(m.id)).length })).filter(
    (m) => m.count > 0,
  );
  const href = (patch: Partial<Filters>) => {
    const next = { muscle, showArchived, ...patch };
    const q = new URLSearchParams();
    if (next.muscle) q.set('muscle', next.muscle);
    if (next.showArchived) q.set('archived', '1');
    const s = q.toString();
    return s ? `/exercises?${s}` : '/exercises';
  };
  const pick = (id: MuscleId) => navigate(href({ muscle: id === muscle ? null : id }), { replace: true });

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
            <MuscleFigure highlighted={muscle ? [muscle] : []} onSelect={pick} className="h-40 w-40 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
              <div>
                <p className="text-muted-foreground text-xs">{muscle ? 'Showing exercises for' : 'Showing'}</p>
                <p
                  className={cn(
                    'mt-0.5 truncate text-xl font-bold',
                    muscle && 'text-[#c2364f] dark:text-[#e8657f]',
                  )}
                >
                  {muscle ? muscleLabel(muscle) : 'All exercises'}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {exercises.length} in your {showArchived ? 'archive' : 'library'}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">Tap a muscle to filter</p>
            </div>
          </section>

          <div role="group" aria-label="Muscle" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {[null, ...counts].map((m) => {
              const selected = (m?.id ?? null) === muscle;
              return (
                <AppLink
                  key={m?.id ?? 'all'}
                  href={href({ muscle: m?.id ?? null })}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm',
                    selected ? 'border-[#e8657f] bg-[#e8657f] font-semibold text-[#0a0a0a]' : 'bg-card',
                  )}
                >
                  {m ? m.label : 'All'}
                </AppLink>
              );
            })}
          </div>
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
                    side={muscle ? sideFor([muscle]) : sideFor(e.muscles)}
                    highlighted={e.muscles}
                    className="h-12 w-6 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.name}</span>
                    {e.muscleGroup && <span className="text-muted-foreground block truncate text-sm">{e.muscleGroup}</span>}
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
