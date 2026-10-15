'use client';

import { Upload } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';

import { importBackupAction } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function ImportBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    setMessage(null);
    startTransition(async () => {
      const result = await importBackupAction(form);
      if (input.current) input.current.value = '';
      if (!result.ok) return setMessage({ error: true, text: result.error });
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
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <Spinner /> : <Upload />} {pending ? 'Importing…' : 'Choose backup file'}
      </Button>
      {message && (
        <p role="status" className={message.error ? 'text-destructive text-sm' : 'text-sm'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
