'use client';

import { Check, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { deleteWorkoutAction, finishWorkoutAction, resumeWorkoutAction, updateWorkoutNotesAction } from '@/actions/workouts';
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
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDuration } from '@/lib/format';
import { volumeKg } from '@/lib/progress';
import { convertWeight, formatNumber, type WeightUnit } from '@/lib/units';
import type { ExerciseSummary } from '@/server/exercises';
import type { ExerciseSession } from '@/server/history';
import type { WorkoutDetail } from '@/server/workouts';

import { ExerciseCard } from './exercise-card';
import { ExercisePicker } from './exercise-picker';

export function WorkoutEditor({
  workout,
  lastTime,
  defaultUnit,
  exercises,
}: {
  workout: WorkoutDetail;
  lastTime: Record<string, ExerciseSession>;
  defaultUnit: WeightUnit;
  exercises: ExerciseSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inProgress = workout.endedAt === null;
  // A finished workout's sets can still be edited; new sets only while in progress.
  const allSets = workout.exercises.flatMap((e) => e.sets);
  const volume = convertWeight(volumeKg(allSets), 'kg', defaultUnit);

  function finish() {
    startTransition(async () => {
      const result = await finishWorkoutAction(workout.id);
      if (!result.ok) return void toast.error(result.error);
      if (result.data.discarded) {
        toast('Workout discarded: it had no sets.');
        router.push('/');
      } else {
        toast.success('Workout saved');
      }
    });
  }

  function resume() {
    startTransition(async () => {
      const result = await resumeWorkoutAction(workout.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteWorkoutAction(workout.id);
      if (result && !result.ok) toast.error(result.error);
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
          </>
        }
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Workout options" disabled={pending}>
                {pending ? <Spinner /> : <MoreHorizontal />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

      {workout.exercises.map((row) => (
        <ExerciseCard
          key={row.id}
          row={row}
          lastTime={lastTime[row.exercise.id]}
          defaultUnit={defaultUnit}
          editable={inProgress}
        />
      ))}

      {inProgress && <ExercisePicker workoutId={workout.id} exercises={exercises} />}

      <NotesField workoutId={workout.id} initial={workout.notes} />

      {inProgress && (
        <Button size="lg" className="h-12 w-full text-base" onClick={finish} disabled={pending}>
          <Check /> Finish workout
        </Button>
      )}

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

function NotesField({ workoutId, initial }: { workoutId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? '');
  const [saved, setSaved] = useState(initial ?? '');

  async function save() {
    if (value === saved) return;
    const result = await updateWorkoutNotesAction(workoutId, value);
    if (result.ok) setSaved(value);
    else toast.error(result.error);
  }

  return (
    <Textarea
      aria-label="Workout notes"
      placeholder="Notes"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      rows={2}
    />
  );
}
