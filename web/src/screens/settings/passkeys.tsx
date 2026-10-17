'use client';

import { KeyRound, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useHydrated } from '@/hooks/use-hydrated';
import { authClient } from '@/lib/auth-client';
import { deviceLabel, passkeysSupported, wasCancelled } from '@/lib/passkeys';

type Passkey = { id: string; name?: string | null; createdAt?: Date | string | null };

const DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Lists this account's passkeys and adds one for this device. Needs a connection. */
export function Passkeys() {
  const hydrated = useHydrated();
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await authClient.passkey.listUserPasskeys();
    setFailed(Boolean(error));
    if (data) setPasskeys(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server
    void load();
  }, [load]);

  async function add() {
    setAdding(true);
    const { error } = await authClient.passkey.addPasskey({ name: deviceLabel() });
    setAdding(false);
    if (!error) {
      toast.success('Passkey added. Next time, sign in with Face ID or Touch ID.');
      return load();
    }
    if (!wasCancelled(error)) toast.error(error.message || 'Couldn’t add the passkey. Try again.');
  }

  async function remove(id: string) {
    const { error } = await authClient.passkey.deletePasskey({ id });
    if (error) return toast.error('Couldn’t remove the passkey. Check your connection and try again.');
    setPasskeys((list) => list?.filter((p) => p.id !== id) ?? null);
  }

  if (hydrated && !passkeysSupported()) {
    return <p className="text-muted-foreground text-sm">This browser doesn’t support passkeys.</p>;
  }

  return (
    <div className="space-y-3">
      {failed && !passkeys ? (
        <p className="text-muted-foreground text-sm">Connect to the internet to see your passkeys.</p>
      ) : passkeys === null ? (
        <Spinner />
      ) : passkeys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No passkeys yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <KeyRound className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium">{p.name || 'Passkey'}</div>
                {p.createdAt && <div className="text-muted-foreground">Added {DATE.format(new Date(p.createdAt))}</div>}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${p.name || 'passkey'}`}>
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You won’t be able to sign in with it any more. Also delete it from your device’s Passwords app.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(p.id)}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" onClick={add} disabled={adding || failed}>
        {adding ? <Spinner /> : <KeyRound />}
        Add a passkey for this device
      </Button>
    </div>
  );
}
