'use client';

import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { deleteSetAction, updateSetAction } from '@/actions/workouts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { SetRow } from '@/server/workouts';

import { SetForm } from './set-form';

export function EditSetDialog({ set, onClose }: { set: SetRow | null; onClose: () => void }) {
  const [deleting, startDelete] = useTransition();

  function remove() {
    if (!set) return;
    startDelete(async () => {
      const result = await deleteSetAction(set.id);
      if (result.ok) onClose();
      else toast.error(result.error);
    });
  }

  return (
    <Dialog open={set !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-[30%] sm:top-1/2">
        <DialogHeader>
          <DialogTitle>Edit set</DialogTitle>
          <DialogDescription className="sr-only">Change or delete this set.</DialogDescription>
        </DialogHeader>
        {set && (
          <SetForm
            key={set.id}
            initial={set}
            submitLabel="Save"
            onSubmit={async (values) => {
              const result = await updateSetAction(set.id, values);
              if (result.ok) onClose();
              return result;
            }}
            extraActions={
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="text-destructive h-11"
                onClick={remove}
                disabled={deleting}
                aria-label="Delete set"
              >
                <Trash2 />
              </Button>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
