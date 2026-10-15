'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { clearOfflineCache } from '@/lib/pwa';

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    // Don't leave this account's pages readable offline on a shared device.
    await clearOfflineCache();
    // A full page load also drops the client router's in-memory copy of this account's pages.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/sign-in');
  }

  return (
    <Button variant="outline" onClick={signOut} disabled={pending}>
      {pending ? <Spinner /> : <LogOut />} Sign out
    </Button>
  );
}
