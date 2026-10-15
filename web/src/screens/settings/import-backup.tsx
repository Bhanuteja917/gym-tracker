'use client';

import { Upload } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';

import { importBackupAction } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useLocal, useSyncState } from '@/local/provider';

export function ImportBackup() {
  const { engine } = useLocal();
  const { problem } = useSyncState();
  const offline = problem === 'offline';
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    setMessage(null);
    startTransition(async () => {
      let result;
      try {
        result = await importBackupAction(form);
      } catch {
        result = { ok: false as const, error: 'Couldn’t reach the server. Try again when you’re online.' };
      }
      if (input.current) input.current.value = '';
      if (!result.ok) return setMessage({ error: true, text: result.error });
      // Download the imported workouts to this device.
      await engine.sync();
      const r = result.data;
      setMessage({
        error: false,
        text:
          `Imported ${r.workoutsImported} workouts (${r.setsImported} sets) and ${r.exercisesCreated} new exercises.` +
          (r.workoutsSkipped ? ` Skipped ${r.workoutsSkipped} already imported.` : ''),
      });
    });
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
        tabIndex={-1}
        aria-hidden
      />
      <Button variant="outline" className="w-full" disabled={pending || offline} onClick={() => input.current?.click()}>
        {pending ? <Spinner /> : <Upload />} {pending ? 'Importing…' : 'Choose backup file'}
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
