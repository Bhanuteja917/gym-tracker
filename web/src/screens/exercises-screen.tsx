'use client';

import { ChevronRight, Plus } from 'lucide-react';

import { ExerciseFormDialog } from '@/components/exercise-form-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { muscleGroupsFrom } from '@/local/mutations';
import { useLocalQuery } from '@/local/provider';
import { listExercises } from '@/local/queries';
import { AppLink } from '@/local/router';
import { cn } from '@/lib/utils';

export function ExercisesScreen({ group, showArchived }: { group: string | null; showArchived: boolean }) {
  const all = useLocalQuery(listExercises, []);

  if (all === undefined) {
    return (
      <>
        <PageHeader title="Exercises" />
        <ListSkeleton rows={8} className="h-12" />
      </>
    );
  }

  const muscleGroups = muscleGroupsFrom(all);
  const visible = all.filter((e) => e.archived === showArchived);
  const exercises = visible.filter((e) => !group || e.muscleGroup?.toLowerCase() === group.toLowerCase());
  const groupsInUse = muscleGroups.filter((g) => visible.some((e) => e.muscleGroup?.toLowerCase() === g.toLowerCase()));
  const href = (patch: { group?: string | null; archived?: boolean }) => {
    const q = new URLSearchParams();
    const g = patch.group === undefined ? group : patch.group;
    if (g) q.set('group', g);
    if (patch.archived ?? showArchived) q.set('archived', '1');
    const s = q.toString();
    return s ? `/exercises?${s}` : '/exercises';
  };

  return (
    <>
      <PageHeader
        title={showArchived ? 'Archived' : 'Exercises'}
        actions={
          <ExerciseFormDialog
            muscleGroups={muscleGroups}
            trigger={
              <Button size="icon" aria-label="New exercise">
                <Plus />
              </Button>
            }
          />
        }
      />

      {groupsInUse.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {[null, ...groupsInUse].map((g) => (
            <AppLink
              key={g ?? 'all'}
              href={href({ group: g })}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm',
                (g ?? null) === group ? 'bg-primary text-primary-foreground border-primary' : 'bg-card',
              )}
            >
              {g ?? 'All'}
            </AppLink>
          ))}
        </div>
      )}

      {exercises.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {showArchived ? 'No archived exercises.' : 'No exercises yet. Add one with +.'}
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
        <AppLink href={href({ archived: !showArchived, group: null })} className="text-muted-foreground text-sm">
          {showArchived ? 'Back to exercises' : 'Show archived'}
        </AppLink>
      </div>
    </>
  );
}
