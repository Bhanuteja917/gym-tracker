'use client';

import { Library } from 'lucide-react';
import { useState, useTransition } from 'react';

import { importExerciseLibraryAction } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useLocal, useSyncState } from '@/local/provider';

export function ExerciseLibrary() {
  const { engine } = useLocal();
  const { problem } = useSyncState();
  const offline = problem === 'offline';
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onAdd() {
    setMessage(null);
    startTransition(async () => {
      let result;
      try {
        result = await importExerciseLibraryAction();
      } catch {
        result = { ok: false as const, error: 'Couldn’t reach the server. Try again when you’re online.' };
      }
      if (!result.ok) return setMessage({ error: true, text: result.error });
      // Download the new exercises to this device.
      await engine.sync();
      const { created, skipped, corrected, hidden } = result.data;
      const parts = [
        created === 0 ? 'You already have every exercise in the library.' : `Added ${created} exercises.`,
        created > 0 && skipped > 0 && `Skipped ${skipped} you already had.`,
        corrected > 0 && `Corrected the name or muscle group of ${corrected}.`,
        hidden > 0 && `Archived ${hidden} duplicates and foam-rolling entries you never logged.`,
      ];
      setMessage({ error: false, text: parts.filter(Boolean).join(' ') });
    });
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full" disabled={pending || offline} onClick={onAdd}>
        {pending ? <Spinner /> : <Library />} {pending ? 'Updating…' : 'Add or update exercise library'}
      </Button>
      {offline && <p className="text-muted-foreground text-sm">Available when you’re online.</p>}
      {message && (
        <p role="status" className={message.error ? 'text-destructive text-sm' : 'text-sm'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
