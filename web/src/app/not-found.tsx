import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-muted-foreground text-sm">It may have been deleted.</p>
      <Button asChild>
        <Link href="/">Back to workouts</Link>
      </Button>
    </main>
  );
}
