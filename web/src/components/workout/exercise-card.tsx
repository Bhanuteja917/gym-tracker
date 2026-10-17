'use client';

import { MoreHorizontal, PlayCircle, Trash2 } from 'lucide-react';
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
import { formatRest } from '@/lib/format';
import { formatTarget, type PlanItem } from '@/lib/plan';
import { suggestNextSet } from '@/lib/suggest';
import { formatSet, type WeightUnit } from '@/lib/units';

import { EditSetDialog } from './edit-set-dialog';
import { parseSetForm, SetForm } from './set-form';

export function ExerciseCard({
  row,
  lastTime,
  defaultUnit,
  target,
  editable,
}: {
  row: WorkoutExerciseRow;
  lastTime: ExerciseSession | undefined;
  defaultUnit: WeightUnit;
  target?: PlanItem;
  editable: boolean;
}) {
  const { mutate } = useLocal();
  const [editing, setEditing] = useState<SetRow | null>(null);
  const [removing, startRemove] = useTransition();
  const suggestion = suggestNextSet(row.sets, lastTime?.sets, defaultUnit);

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
          <h2 className="truncate font-semibold">
            <AppLink href={`/exercise?id=${row.exercise.id}`}>{row.exercise.name}</AppLink>
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
            const rest = i > 0 ? formatRest(set.completedAt.getTime() - row.sets[i - 1]!.completedAt.getTime()) : null;
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
                  {rest && <span className="text-muted-foreground text-xs tabular-nums">rest {rest}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {editable && (
        <div className="p-4">
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

      <EditSetDialog set={editing} onClose={() => setEditing(null)} />
    </section>
  );
}
