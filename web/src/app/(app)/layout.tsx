import { OfflineBadge } from '@/components/offline-badge';
import { TabBar } from '@/components/tab-bar';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <OfflineBadge />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+5rem)]">
        {children}
      </main>
      <TabBar />
    </>
  );
}
