'use client';

import { ArrowDownUp, Check, MoreHorizontal, Play, RotateCcw, Trash2 } from 'lucide-react';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { LocalTime } from '@/components/local-time';
import { PageHeader } from '@/components/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { UnsyncedLabel } from '@/components/workout-summary-card';
import type { LocalExercise } from '@/local/db';
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  removeWorkoutExercise,
  resumeWorkout,
  setCurrentExercise,
  updateWorkoutNotes,
} from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { type ExerciseSession, getCurrentExerciseId, type WorkoutDetail, type WorkoutExerciseRow } from '@/local/queries';
import { navigate } from '@/local/router';
import { formatDuration } from '@/lib/format';
import { formatTarget, type PlanItem } from '@/lib/plan';
import { volumeKg } from '@/lib/progress';
import { convertWeight, formatNumber, formatSet, type WeightUnit } from '@/lib/units';
import { notesSchema } from '@/lib/validation';

import { ExerciseCard } from './exercise-card';
import { ExercisePicker } from './exercise-picker';
import { ReorderSheet } from './reorder-sheet';

export function WorkoutEditor({
  workout,
  lastTime,
  defaultUnit,
  targets,
  exercises,
}: {
  workout: WorkoutDetail;
  lastTime: Record<string, ExerciseSession>;
  defaultUnit: WeightUnit;
  /** Planned sets × reps by exercise id. */
  targets: Record<string, PlanItem>;
  exercises: LocalExercise[];
}) {
  const { mutate } = useLocal();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reordering, setReordering] = useState(false);
  const inProgress = workout.endedAt === null;
  // A finished workout's sets can still be edited; new sets only while in progress.
  const allSets = workout.exercises.flatMap((e) => e.sets);
  const volume = convertWeight(volumeKg(allSets), 'kg', defaultUnit);
  const currentId = useLocalQuery((db) => getCurrentExerciseId(db, workout.id), [workout.id]);

  // Exercises are kept in the order they were done (see addSet): done ones
  // first, numbered, then the ones not started yet.
  const done = workout.exercises.filter((e) => e.sets.length > 0);
  const orderOf = (row: WorkoutExerciseRow) => (row.sets.length > 0 ? done.indexOf(row) + 1 : undefined);
  // The current exercise: the one marked, else the one a set was last logged for.
  const lastLogged = allSets.reduce<(typeof allSets)[number] | undefined>(
    (latest, s) => (!latest || s.completedAt > latest.completedAt ? s : latest),
    undefined,
  );
  const current = inProgress
    ? (workout.exercises.find((e) => e.id === currentId) ??
      workout.exercises.find((e) => e.id === lastLogged?.workoutExerciseId))
    : undefined;
  const upNext = workout.exercises.filter((e) => e.sets.length === 0 && e !== current);

  function makeCurrent(row: WorkoutExerciseRow) {
    startTransition(async () => {
      const result = await mutate((db) => setCurrentExercise(db, workout.id, row.id));
      if (!result.ok) return void toast.error(result.error);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function removeUpNext(row: WorkoutExerciseRow) {
    startTransition(async () => {
      const result = await mutate((db) => removeWorkoutExercise(db, row.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  const card = (row: WorkoutExerciseRow, props: { editable: boolean; onContinue?: () => void }) => (
    <ExerciseCard
      key={row.id}
      row={row}
      lastTime={lastTime[row.exercise.id]}
      defaultUnit={defaultUnit}
      target={targets[row.exercise.id]}
      order={orderOf(row)}
      {...props}
    />
  );

  function finish() {
    startTransition(async () => {
      const result = await mutate((db) => finishWorkout(db, workout.id));
      if (!result.ok) return void toast.error(result.error);
      if (result.data.discarded) {
        toast('Workout discarded: it had no sets.');
        navigate('/', { replace: true });
      } else {
        toast.success('Workout saved');
      }
    });
  }

  function resume() {
    startTransition(async () => {
      const result = await mutate((db) => resumeWorkout(db, workout.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await mutate((db) => deleteWorkout(db, workout.id));
      if (result.ok) navigate('/', { replace: true });
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={<LocalTime date={workout.startedAt} format="day" />}
        subtitle={
          <>
            <LocalTime date={workout.startedAt} format="time" />
            {workout.endedAt
              ? ` · ${formatDuration(workout.endedAt.getTime() - workout.startedAt.getTime())}`
              : ' · In progress'}
            {allSets.length > 0 &&
              ` · ${allSets.length} sets${volume > 0 ? ` · ${formatNumber(volume, 0)} ${defaultUnit}` : ''}`}
            {workout.unsynced && (
              <>
                <br />
                <UnsyncedLabel />
              </>
            )}
          </>
        }
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Workout options" disabled={pending}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {done.length > 1 && (
                <DropdownMenuItem onSelect={() => setReordering(true)}>
                  <ArrowDownUp /> Change exercise order
                </DropdownMenuItem>
              )}
              {!inProgress && (
                <DropdownMenuItem onSelect={resume}>
                  <RotateCcw /> Resume workout
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete workout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {!inProgress && workout.exercises.map((row) => card(row, { editable: false }))}

      {inProgress && (
        <>
          {current ? (
            <section aria-label="Now" className="space-y-2">
              <SectionLabel>Now</SectionLabel>
              {card(current, { editable: true })}
            </section>
          ) : (
            workout.exercises.length > 0 && (
              <p className="bg-muted/50 rounded-xl p-4 text-sm">
                Tap <span className="font-medium">Start</span> on the exercise you’re doing first. The order you do
                them in is saved, so you can see later how one exercise affects the next.
              </p>
            )
          )}

          {upNext.length > 0 && (
            <section aria-label="Up next" className="space-y-2">
              <SectionLabel>Up next · {upNext.length}</SectionLabel>
              <ul className="bg-card divide-y rounded-xl border" aria-busy={pending}>
                {upNext.map((row) => (
                  <UpNextRow
                    key={row.id}
                    row={row}
                    target={targets[row.exercise.id]}
                    lastTime={lastTime[row.exercise.id]}
                    disabled={pending}
                    onStart={() => makeCurrent(row)}
                    onRemove={() => removeUpNext(row)}
                  />
                ))}
              </ul>
            </section>
          )}

          <ExercisePicker
            exercises={exercises}
            onPick={async (db, id) => setCurrentExercise(db, workout.id, await addExerciseToWorkout(db, workout.id, id))}
          />

          {done.some((row) => row !== current) && (
            <section aria-label="Done" className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionLabel>Done</SectionLabel>
                {done.length > 1 && (
                  <Button variant="ghost" size="sm" className="-my-1" onClick={() => setReordering(true)}>
                    <ArrowDownUp /> Change order
                  </Button>
                )}
              </div>
              {done
                .filter((row) => row !== current)
                .map((row) => card(row, { editable: false, onContinue: () => makeCurrent(row) }))}
            </section>
          )}
        </>
      )}

      <NotesField workoutId={workout.id} initial={workout.notes} />

      {inProgress && (
        <Button size="lg" className="h-12 w-full text-base" onClick={finish} disabled={pending}>
          <Check /> Finish workout
        </Button>
      )}

      <ReorderSheet workoutId={workout.id} done={done} open={reordering} onOpenChange={setReordering} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
            <AlertDialogDescription>All its sets are deleted too. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{children}</h2>;
}

/** An exercise not started yet: its target and last time, and a button to start it. */
function UpNextRow({
  row,
  target,
  lastTime,
  disabled,
  onStart,
  onRemove,
}: {
  row: WorkoutExerciseRow;
  target?: PlanItem;
  lastTime?: ExerciseSession;
  disabled: boolean;
  onStart: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 py-2 pr-2 pl-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.exercise.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {[target && `Plan: ${formatTarget(target)}`, lastTime && `Last: ${lastTime.sets.map((s) => formatSet(s)).join(', ')}`]
            .filter(Boolean)
            .join(' · ') || row.exercise.muscleGroup}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-9"
        aria-label={`Remove ${row.exercise.name}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
      <Button size="sm" disabled={disabled} onClick={onStart} aria-label={`Start ${row.exercise.name}`}>
        <Play /> Start
      </Button>
    </li>
  );
}

/** Saved on the device as you type (debounced) and when you leave the field. */
function NotesField({ workoutId, initial }: { workoutId: string; initial: string | null }) {
  const { mutate } = useLocal();
  const [value, setValue] = useState(initial ?? '');
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  async function save(text: string) {
    const parsed = notesSchema.safeParse(text);
    if (!parsed.success) return void toast.error('Notes are too long');
    const result = await mutate((db) => updateWorkoutNotes(db, workoutId, parsed.data));
    if (!result.ok) toast.error(result.error);
  }

  function change(text: string) {
    setValue(text);
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => void save(text), 1000));
  }

  return (
    <Textarea
      aria-label="Workout notes"
      placeholder="Notes"
      value={value}
      onChange={(e) => change(e.target.value)}
      onBlur={() => {
        if (timer) clearTimeout(timer);
        void save(value);
      }}
      rows={2}
    />
  );
}
