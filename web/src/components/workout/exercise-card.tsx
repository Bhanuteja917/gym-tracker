'use client';

import { MoreHorizontal, PlayCircle, Plus, Repeat2, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addSet, removeWorkoutExercise } from '@/local/mutations';
import { useLocal } from '@/local/provider';
import type { ExerciseSession, SetRow, WorkoutExerciseRow } from '@/local/queries';
import { AppLink } from '@/local/router';
import { formatTarget, type PlanItem } from '@/lib/plan';
import { suggestNextSet } from '@/lib/suggest';
import { formatSeconds, formatSet, type WeightUnit } from '@/lib/units';

import { EditSetDialog } from './edit-set-dialog';
import { parseSetForm, SetForm } from './set-form';

export function ExerciseCard({
  row,
  lastTime,
  defaultUnit,
  target,
  editable,
  order,
  onContinue,
}: {
  row: WorkoutExerciseRow;
  lastTime: ExerciseSession | undefined;
  defaultUnit: WeightUnit;
  target?: PlanItem;
  /** Shows the set form for logging the next set. */
  editable: boolean;
  /** Its place in the order the workout was done (1 = first). */
  order?: number;
  /** For an exercise already done: makes it the current one again, to log more sets. */
  onContinue?: () => void;
}) {
  const { mutate } = useLocal();
  const [editing, setEditing] = useState<SetRow | null>(null);
  const [removing, startRemove] = useTransition();
  const [logging, startLogging] = useTransition();
  const suggestion = suggestNextSet(row.sets, lastTime?.sets, defaultUnit);
  // One tap logs the pre-filled set: the previous one, else last time's.
  const repeatable = (row.sets.length > 0 || lastTime) && (suggestion.reps !== null || suggestion.durationSec !== null);

  function logSame() {
    startLogging(async () => {
      const input = parseSetForm({
        weight: suggestion.weight === null ? '' : String(suggestion.weight),
        unit: suggestion.unit,
        reps: suggestion.reps === null ? '' : String(suggestion.reps),
        durationSec: suggestion.durationSec === null ? '' : formatSeconds(suggestion.durationSec),
        rpe: '',
        notes: '',
      });
      if (!input.ok) return void toast.error(input.error);
      const result = await mutate((db) => addSet(db, row.id, input.data));
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    if (row.sets.length > 0 && !confirm(`Remove ${row.exercise.name} and its ${row.sets.length} sets?`)) return;
    startRemove(async () => {
      const result = await mutate((db) => removeWorkoutExercise(db, row.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <section className="bg-card rounded-xl border" aria-busy={removing}>
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2 font-semibold">
            {order !== undefined && (
              <span
                className="bg-muted text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center self-center rounded-full text-xs tabular-nums"
                aria-label={`Done ${order}${order === 1 ? 'st' : order === 2 ? 'nd' : order === 3 ? 'rd' : 'th'}`}
              >
                {order}
              </span>
            )}
            <AppLink href={`/exercise?id=${row.exercise.id}`} className="truncate">
              {row.exercise.name}
            </AppLink>
          </h2>
          {target && (
            <p className="text-muted-foreground text-xs">
              Plan: {formatTarget(target)}
              {row.sets.length > 0 && ` · ${row.sets.length}/${target.sets} done`}
            </p>
          )}
          {lastTime && (
            <p className="text-muted-foreground truncate text-xs">
              Last: {lastTime.sets.map((s) => formatSet(s)).join(', ')}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`${row.exercise.name} options`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.exercise.videoUrl && (
              <DropdownMenuItem asChild>
                <a href={row.exercise.videoUrl} target="_blank" rel="noopener noreferrer">
                  <PlayCircle /> Watch video
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={remove}>
              <Trash2 /> Remove from workout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {row.sets.length > 0 && (
        <ol className="divide-y border-y">
          {row.sets.map((set, i) => {
            return (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => setEditing(set)}
                  className="active:bg-accent flex w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <span className="text-muted-foreground w-5 text-sm tabular-nums">{i + 1}</span>
                  <span className="flex-1 font-medium tabular-nums">{formatSet(set)}</span>
                  {set.notes && <span className="text-muted-foreground max-w-24 truncate text-xs">{set.notes}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {editable && (
        <div className="space-y-3 p-4">
          {repeatable && (
            <Button variant="secondary" size="lg" className="h-12 w-full text-base" disabled={logging} onClick={logSame}>
              <Repeat2 /> {row.sets.length > 0 ? 'Same as last' : 'Same as last time'}:{' '}
              <span className="tabular-nums">{formatSet(suggestion)}</span>
            </Button>
          )}
          <SetForm
            // Remount after each logged set so the form pre-fills the next one.
            key={row.sets.length}
            initial={suggestion}
            submitLabel={`Log set ${row.sets.length + 1}`}
            onSubmit={async (values) => {
              const input = parseSetForm(values);
              if (!input.ok) return input;
              return mutate((db) => addSet(db, row.id, input.data));
            }}
          />
        </div>
      )}

      {onContinue && (
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={onContinue}>
            <Plus /> Log another set
          </Button>
        </div>
      )}

      <EditSetDialog set={editing} onClose={() => setEditing(null)} />
    </section>
  );
}
