'use client';

import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { deleteExerciseAction, setExerciseArchivedAction } from '@/actions/exercises';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ExerciseActions({ id, archived, hasHistory }: { id: string; archived: boolean; hasHistory: boolean }) {
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string } | undefined>) =>
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) toast.error(result.error);
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Exercise options" disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run(() => setExerciseArchivedAction(id, !archived))}>
          {archived ? <ArchiveRestore /> : <Archive />} {archived ? 'Unarchive' : 'Archive'}
        </DropdownMenuItem>
        {!hasHistory && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => confirm('Delete this exercise?') && run(() => deleteExerciseAction(id))}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
