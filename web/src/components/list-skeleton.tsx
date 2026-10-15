import { Skeleton } from '@/components/ui/skeleton';

export function ListSkeleton({ rows = 3, className = 'h-24' }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`w-full rounded-xl ${className}`} />
      ))}
    </div>
  );
}
