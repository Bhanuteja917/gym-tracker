'use client';

import { ChevronRight, PersonStanding, Plus, X } from 'lucide-react';

import { ExerciseFormDialog } from '@/components/exercise-form-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { MuscleFigure } from '@/components/muscle-figure/muscle-figure';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { muscleGroupsFrom } from '@/local/mutations';
import { useLocalQuery } from '@/local/provider';
import { listExercises } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';
import { isMuscleId, muscleLabel, musclesFor } from '@/lib/muscles';
import { cn } from '@/lib/utils';

type Filters = { group: string | null; muscle: string | null; showMap: boolean; showArchived: boolean };

export function ExercisesScreen({ group, muscle: muscleParam, showMap, showArchived }: Filters) {
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
  const muscleGroups = muscleGroupsFrom(all);
  const visible = all.filter((e) => e.archived === showArchived);
  const exercises = visible.filter(
    (e) =>
      (!group || e.muscleGroup?.toLowerCase() === group.toLowerCase()) &&
      (!muscle || musclesFor(e.muscleGroup).includes(muscle)),
  );
  const groupsInUse = muscleGroups.filter((g) => visible.some((e) => e.muscleGroup?.toLowerCase() === g.toLowerCase()));
  // A group chip and a muscle on the body map are alternative filters: picking one clears the other.
  const href = (patch: Partial<Filters>) => {
    const next = { group, muscle, showMap, showArchived, ...patch };
    const q = new URLSearchParams();
    if (next.group) q.set('group', next.group);
    if (next.muscle) q.set('muscle', next.muscle);
    if (next.showMap) q.set('map', '1');
    if (next.showArchived) q.set('archived', '1');
    const s = q.toString();
    return s ? `/exercises?${s}` : '/exercises';
  };

  return (
    <>
      <PageHeader
        title={showArchived ? 'Archived' : 'Exercises'}
        actions={
          <>
            <Button
              asChild
              variant={showMap ? 'secondary' : 'outline'}
              size="icon"
              aria-label={showMap ? 'Hide body map' : 'Show body map'}
              aria-pressed={showMap}
            >
              <AppLink href={href({ showMap: !showMap, muscle: null })}>
                <PersonStanding />
              </AppLink>
            </Button>
            <ExerciseFormDialog
              muscleGroups={muscleGroups}
              trigger={
                <Button size="icon" aria-label="New exercise">
                  <Plus />
                </Button>
              }
            />
          </>
        }
      />

      {showMap && (
        <div className="mb-3 space-y-2">
          <MuscleFigure
            highlighted={muscle ? [muscle] : []}
            onSelect={(id) => navigate(href({ muscle: id === muscle ? null : id, group: null }), { replace: true })}
          />
          <p className="text-muted-foreground text-center text-xs">Drag to turn · tap a muscle to filter</p>
        </div>
      )}

      {muscle && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Targets</span>
          <AppLink
            href={href({ muscle: null })}
            className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1"
            aria-label={`Clear ${muscleLabel(muscle)} filter`}
          >
            {muscleLabel(muscle)} <X className="size-3.5" />
          </AppLink>
        </div>
      )}

      {groupsInUse.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {[null, ...groupsInUse].map((g) => (
            <AppLink
              key={g ?? 'all'}
              href={href({ group: g, muscle: null })}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm',
                (g ?? null) === group && !muscle ? 'bg-primary text-primary-foreground border-primary' : 'bg-card',
              )}
            >
              {g ?? 'All'}
            </AppLink>
          ))}
        </div>
      )}

      {exercises.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {muscle
            ? `No exercises target ${muscleLabel(muscle).toLowerCase()}.`
            : showArchived
              ? 'No archived exercises.'
              : 'No exercises yet. Add one with +.'}
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {exercises.map((e) => (
            <li key={e.id}>
              <AppLink href={`/exercise?id=${e.id}`} className="active:bg-accent flex items-center gap-3 px-4 py-3">
                <span className="flex-1 truncate">{e.name}</span>
                {e.muscleGroup && <span className="text-muted-foreground text-sm">{e.muscleGroup}</span>}
                <ChevronRight className="text-muted-foreground size-4" />
              </AppLink>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-center">
        <AppLink href={href({ showArchived: !showArchived, group: null, muscle: null })} className="text-muted-foreground text-sm">
          {showArchived ? 'Back to exercises' : 'Show archived'}
        </AppLink>
      </div>
    </>
  );
}
