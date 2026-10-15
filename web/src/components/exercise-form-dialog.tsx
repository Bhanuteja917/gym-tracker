'use client';

import { useId, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { createExercise, updateExercise } from '@/local/mutations';
import { useLocal } from '@/local/provider';
import { exerciseInputSchema, firstError } from '@/lib/validation';

type Values = { name: string; muscleGroup: string; videoUrl: string };

/** Create an exercise, or edit one when `exercise` is given. */
export function ExerciseFormDialog({
  exercise,
  muscleGroups,
  trigger,
}: {
  exercise?: { id: string; name: string; muscleGroup: string | null; videoUrl: string | null };
  muscleGroups: string[];
  trigger: ReactNode;
}) {
  const id = useId();
  const { mutate } = useLocal();
  const initial: Values = {
    name: exercise?.name ?? '',
    muscleGroup: exercise?.muscleGroup ?? '',
    videoUrl: exercise?.videoUrl ?? '',
  };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(initial);
      setError(null);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = exerciseInputSchema.safeParse(values);
    if (!input.success) return setError(firstError(input.error));
    startTransition(async () => {
      const result = exercise
        ? await mutate((db) => updateExercise(db, exercise.id, input.data))
        : await mutate((db) => createExercise(db, input.data));
      if (!result.ok) return setError(result.error);
      setOpen(false);
      toast.success(exercise ? 'Exercise saved' : `Added ${values.name.trim()}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="top-[30%] sm:top-1/2">
        <DialogHeader>
          <DialogTitle>{exercise ? 'Edit exercise' : 'New exercise'}</DialogTitle>
          <DialogDescription className="sr-only">Name, muscle group and an optional video link.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              autoCapitalize="words"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-group`}>Muscle group</Label>
            <Input
              id={`${id}-group`}
              list={`${id}-groups`}
              value={values.muscleGroup}
              onChange={(e) => setValues({ ...values, muscleGroup: e.target.value })}
              placeholder="Optional"
              autoCapitalize="words"
            />
            <datalist id={`${id}-groups`}>
              {muscleGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-video`}>Video link</Label>
            <Input
              id={`${id}-video`}
              type="url"
              inputMode="url"
              value={values.videoUrl}
              onChange={(e) => setValues({ ...values, videoUrl: e.target.value })}
              placeholder="https://youtube.com/…"
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
