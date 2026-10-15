import { AppShell } from '@/components/app-shell';

/**
 * Every signed-in screen is one static, user-independent page: AppShell reads
 * the on-device database and switches screens on the URL without a server
 * round trip, so the whole app works offline once cached.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <AppShell />
      {children}
    </>
  );
}
