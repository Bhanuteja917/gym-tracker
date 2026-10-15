'use client';

import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteExercise, setExerciseArchived } from '@/local/mutations';
import { type MutationResult, useLocal } from '@/local/provider';
import { navigate } from '@/local/router';

export function ExerciseActions({ id, archived, hasHistory }: { id: string; archived: boolean; hasHistory: boolean }) {
  const { mutate } = useLocal();
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<MutationResult<void>>, then?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else then?.();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Exercise options" disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run(() => mutate((db) => setExerciseArchived(db, id, !archived)))}>
          {archived ? <ArchiveRestore /> : <Archive />} {archived ? 'Unarchive' : 'Archive'}
        </DropdownMenuItem>
        {!hasHistory && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              confirm('Delete this exercise?') &&
              run(
                () => mutate((db) => deleteExercise(db, id)),
                () => navigate('/exercises', { replace: true }),
              )
            }
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
