'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { deleteLocalData, setStoredAccount, setUnsyncedAccount } from '@/local/account';
import { useLocal } from '@/local/provider';
import { authClient } from '@/lib/auth-client';

/**
 * Syncs first. With everything synced, signing out deletes this account's data
 * from the device. With changes still unsynced (offline), it asks first and
 * keeps them on the device until this account signs in again.
 */
export function SignOutButton() {
  const { db, engine, account } = useLocal();
  const [pending, setPending] = useState(false);
  const [unsynced, setUnsynced] = useState(0);

  async function signOut(force: boolean) {
    setPending(true);
    await engine.sync();
    const count = new Set((await db.outbox.toArray()).map((e) => `${e.entity}:${e.entityId}`)).size;
    if (count > 0 && !force) {
      setUnsynced(count);
      setPending(false);
      return;
    }
    let failed = false;
    try {
      const { error } = await authClient.signOut();
      failed = Boolean(error);
    } catch {
      failed = true;
    }
    if (failed) {
      toast.error('Signing out needs a connection.');
      setPending(false);
      return;
    }
    engine.stop();
    db.close();
    if (count > 0) setUnsyncedAccount({ email: account.email, count });
    else await deleteLocalData(account.id);
    setStoredAccount(null);
    // A full page load drops everything this account had in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/sign-in');
  }

  return (
    <>
      <Button variant="outline" onClick={() => void signOut(false)} disabled={pending}>
        {pending ? <Spinner /> : <LogOut />} Sign out
      </Button>
      <AlertDialog open={unsynced > 0} onOpenChange={(open) => !open && setUnsynced(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {unsynced} {unsynced === 1 ? 'change hasn’t' : 'changes haven’t'} synced
            </AlertDialogTitle>
            <AlertDialogDescription>
              They stay on this device and sync the next time you sign in here as {account.email}. Sign out anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={() => void signOut(true)}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
