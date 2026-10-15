import { ChevronRight, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { ExerciseFormDialog } from '@/components/exercise-form-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { listExercises, listMuscleGroups } from '@/server/exercises';
import { requireUser } from '@/server/session';

export const metadata: Metadata = { title: 'Exercises' };

export default function ExercisesPage({ searchParams }: PageProps<'/exercises'>) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Exercises" />
          <ListSkeleton rows={8} className="h-12" />
        </>
      }
    >
      <Exercises searchParams={searchParams} />
    </Suspense>
  );
}

async function Exercises({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  const showArchived = params.archived === '1';
  const group = typeof params.group === 'string' ? params.group : null;
  const [all, muscleGroups] = await Promise.all([
    listExercises(user.id, { includeArchived: showArchived }),
    listMuscleGroups(user.id),
  ]);
  const exercises = all
    .filter((e) => (showArchived ? e.archived : true))
    .filter((e) => !group || e.muscleGroup?.toLowerCase() === group.toLowerCase());
  const groupsInUse = muscleGroups.filter((g) =>
    all.some((e) => e.muscleGroup?.toLowerCase() === g.toLowerCase()),
  );
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
            <Link
              key={g ?? 'all'}
              href={href({ group: g })}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm',
                (g ?? null) === group ? 'bg-primary text-primary-foreground border-primary' : 'bg-card',
              )}
            >
              {g ?? 'All'}
            </Link>
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
              <Link href={`/exercises/${e.id}`} className="active:bg-accent flex items-center gap-3 px-4 py-3">
                <span className="flex-1 truncate">{e.name}</span>
                {e.muscleGroup && <span className="text-muted-foreground text-sm">{e.muscleGroup}</span>}
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-center">
        <Link href={href({ archived: !showArchived, group: null })} className="text-muted-foreground text-sm">
          {showArchived ? 'Back to exercises' : 'Show archived'}
        </Link>
      </div>
    </>
  );
}
