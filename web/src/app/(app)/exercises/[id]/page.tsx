import { PlayCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ExerciseFormDialog } from '@/components/exercise-form-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { LocalTime } from '@/components/local-time';
import { PageHeader } from '@/components/page-header';
import { ProgressChart } from '@/components/progress-chart';
import { Button } from '@/components/ui/button';
import { bestSet, estimatedOneRepMax, progressSeries } from '@/lib/progress';
import { convertWeight, formatNumber, formatSet } from '@/lib/units';
import { DomainError } from '@/server/errors';
import { getExercise, listMuscleGroups } from '@/server/exercises';
import { getExerciseHistory } from '@/server/history';
import { requireUser } from '@/server/session';
import { getDefaultUnit } from '@/server/settings';

import { ExerciseActions } from './exercise-actions';

export const metadata: Metadata = { title: 'Exercise' };

export default function ExercisePage({ params }: PageProps<'/exercises/[id]'>) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} className="h-32" />}>
      <Exercise params={params} />
    </Suspense>
  );
}

async function Exercise({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const exercise = await getExercise(user.id, id).catch((error) => {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') notFound();
    throw error;
  });
  const [history, unit, muscleGroups] = await Promise.all([
    getExerciseHistory(user.id, id),
    getDefaultUnit(user.id),
    listMuscleGroups(user.id),
  ]);

  const allSets = history.flatMap((h) => h.sets);
  const best = bestSet(allSets);
  const bestE1rm = Math.max(
    0,
    ...allSets.map((s) => {
      const e = estimatedOneRepMax(s);
      return e === null ? 0 : convertWeight(e, s.unit, unit);
    }),
  );
  const series = progressSeries(history, unit);

  return (
    <div className="space-y-5">
      <PageHeader
        title={exercise.name}
        subtitle={[exercise.muscleGroup, exercise.archived && 'Archived'].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <ExerciseFormDialog
              exercise={exercise}
              muscleGroups={muscleGroups}
              trigger={<Button variant="outline" size="sm">Edit</Button>}
            />
            <ExerciseActions id={exercise.id} archived={exercise.archived} hasHistory={history.length > 0} />
          </>
        }
      />

      {exercise.videoUrl && (
        <Button asChild variant="outline" className="w-full">
          <a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer">
            <PlayCircle /> Watch video
          </a>
        </Button>
      )}

      {history.length === 0 ? (
        <p className="text-muted-foreground text-sm">No sets logged yet.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Best set" value={best ? formatSet(best) : '–'} />
            <Stat label="Est. 1RM" value={bestE1rm > 0 ? `${formatNumber(bestE1rm)} ${unit}` : '–'} />
            <Stat label="Workouts" value={String(history.length)} />
          </dl>

          <div className="bg-card rounded-xl border p-4">
            <ProgressChart
              points={series.points}
              label={series.metric === 'e1rm' ? `Estimated 1RM (${unit})` : 'Most reps in a set'}
            />
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold">History</h2>
            <ul className="bg-card divide-y rounded-xl border">
              {history.map((h) => (
                <li key={h.workoutId}>
                  <Link href={`/workouts/${h.workoutId}`} className="active:bg-accent block px-4 py-3">
                    <div className="text-sm font-medium">
                      <LocalTime date={h.startedAt} format="day" />
                    </div>
                    <div className="text-muted-foreground text-sm tabular-nums">
                      {h.sets.map((s) => formatSet(s)).join(' · ')}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl border px-2 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
