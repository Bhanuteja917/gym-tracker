'use client';

import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteSet, updateSet } from '@/local/mutations';
import { useLocal } from '@/local/provider';
import type { SetRow } from '@/local/queries';

import { parseSetForm, SetForm } from './set-form';

export function EditSetDialog({ set, onClose }: { set: SetRow | null; onClose: () => void }) {
  const { mutate } = useLocal();
  const [deleting, startDelete] = useTransition();

  function remove() {
    if (!set) return;
    startDelete(async () => {
      const result = await mutate((db) => deleteSet(db, set.id));
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
              const input = parseSetForm(values);
              if (!input.ok) return input;
              const result = await mutate((db) => updateSet(db, set.id, input.data));
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
