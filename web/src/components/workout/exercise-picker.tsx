'use client';

import { Plus, Search } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createExerciseAction } from '@/actions/exercises';
import { addExerciseToWorkoutAction } from '@/actions/workouts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { ExerciseSummary } from '@/server/exercises';

/** Bottom sheet to add an exercise to a workout: search the list or create a new one. */
export function ExercisePicker({ workoutId, exercises }: { workoutId: string; exercises: ExerciseSummary[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      exercises.filter(
        (e) => !q || e.name.toLowerCase().includes(q) || e.muscleGroup?.toLowerCase().includes(q),
      ),
    [exercises, q],
  );
  const exact = exercises.some((e) => e.name.toLowerCase() === q);

  function done(result: { ok: true } | { ok: false; error: string }) {
    if (result.ok) {
      setOpen(false);
      setQuery('');
    } else {
      toast.error(result.error);
    }
  }

  function add(exerciseId: string) {
    startTransition(async () => done(await addExerciseToWorkoutAction(workoutId, exerciseId)));
  }

  function create() {
    startTransition(async () =>
      done(await createExerciseAction({ name: query.trim(), muscleGroup: null, videoUrl: null }, workoutId)),
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 w-full border-dashed text-base">
          <Plus /> Add exercise
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 rounded-t-2xl p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Add exercise</SheetTitle>
          <SheetDescription className="sr-only">Search your exercises or create a new one.</SheetDescription>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Search or create"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9"
              enterKeyHint="done"
            />
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]" aria-busy={pending}>
          {q && !exact && (
            <button
              type="button"
              disabled={pending}
              onClick={create}
              className="active:bg-accent flex w-full items-center gap-2 border-b px-4 py-3 text-left font-medium"
            >
              <Plus className="size-4" /> Create “{query.trim()}”
            </button>
          )}
          <ul className="divide-y">
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => add(e.id)}
                  className="active:bg-accent flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span>{e.name}</span>
                  {e.muscleGroup && <Badge variant="secondary">{e.muscleGroup}</Badge>}
                </button>
              </li>
            ))}
          </ul>
          {matches.length === 0 && !q && (
            <p className="text-muted-foreground p-4 text-sm">No exercises yet. Type a name to create one.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
