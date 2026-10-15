'use client';

import { PlayCircle } from 'lucide-react';

import { ExerciseFormDialog } from '@/components/exercise-form-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { LocalTime } from '@/components/local-time';
import { MuscleFigure } from '@/components/muscle-figure/muscle-figure';
import { PageHeader } from '@/components/page-header';
import { ProgressChart } from '@/components/progress-chart';
import { Button } from '@/components/ui/button';
import { muscleGroupsFrom } from '@/local/mutations';
import { useLocalQuery } from '@/local/provider';
import { getDefaultUnit, getExerciseHistory, listExercises } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';
import { muscleLabel, musclesFor } from '@/lib/muscles';
import { bestSet, estimatedOneRepMax, progressSeries } from '@/lib/progress';
import { convertWeight, formatNumber, formatSeconds, formatSet } from '@/lib/units';

import { ExerciseActions } from './exercise-actions';

const METRIC_LABEL = {
  e1rm: (unit: string) => `Estimated 1RM (${unit})`,
  reps: () => 'Most reps in a set',
  time: () => 'Longest set',
};

export function ExerciseScreen({ id }: { id: string }) {
  const all = useLocalQuery(listExercises, []);
  const history = useLocalQuery((db) => getExerciseHistory(db, id), [id]);
  const unit = useLocalQuery(getDefaultUnit, []);

  if (!all || !history || !unit) return <ListSkeleton rows={3} className="mt-16 h-32" />;
  const exercise = all.find((e) => e.id === id);
  if (!exercise) {
    return (
      <>
        <PageHeader title="Exercise not found" />
        <AppLink href="/exercises" className="text-muted-foreground text-sm underline">
          Back to exercises
        </AppLink>
      </>
    );
  }

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
  const muscles = musclesFor(exercise.muscleGroup);

  return (
    <div className="space-y-5">
      <PageHeader
        title={exercise.name}
        subtitle={[exercise.muscleGroup, exercise.archived && 'Archived'].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <ExerciseFormDialog
              exercise={exercise}
              muscleGroups={muscleGroupsFrom(all)}
              trigger={
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              }
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

      {muscles.length > 0 && (
        <section aria-label="Target muscles" className="space-y-3">
          <div className="bg-card rounded-2xl border px-3 pt-3 pb-2">
            <div className="text-muted-foreground flex justify-around text-[11px] font-semibold tracking-wider uppercase">
              <span>Front</span>
              <span>Back</span>
            </div>
            <MuscleFigure
              highlighted={muscles}
              onSelect={(m) => navigate(`/exercises?muscle=${m}`)}
              className="mx-auto mt-1 h-80 w-full max-w-sm"
            />
          </div>
          <ul className="flex flex-wrap gap-2">
            {muscles.map((m) => (
              <li key={m}>
                <AppLink
                  href={`/exercises?muscle=${m}`}
                  className="bg-card inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm"
                >
                  <span className="size-2.5 rounded-full bg-[#e8657f]" aria-hidden />
                  {muscleLabel(m)}
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
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
              label={METRIC_LABEL[series.metric](unit)}
              format={series.metric === 'time' ? formatSeconds : undefined}
            />
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold">History</h2>
            <ul className="bg-card divide-y rounded-xl border">
              {history.map((h) => (
                <li key={h.workoutId}>
                  <AppLink href={`/workout?id=${h.workoutId}`} className="active:bg-accent block px-4 py-3">
                    <div className="text-sm font-medium">
                      <LocalTime date={h.startedAt} format="day" />
                    </div>
                    <div className="text-muted-foreground text-sm tabular-nums">
                      {h.sets.map((s) => formatSet(s)).join(' · ')}
                    </div>
                  </AppLink>
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
