import { cn } from '@/lib/utils';

/** The SetStack mark. The dark bars turn light in dark mode (see public/brand/). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-16', className)} role="img" aria-label="SetStack">
      <rect x="22" y="8" width="36" height="14" rx="7" fill="#1FC18A" />
      <rect x="10" y="25" width="44" height="14" rx="7" className="fill-[#0E2A25] dark:fill-[#E3F1EC]" />
      <rect x="6" y="42" width="36" height="14" rx="7" className="fill-[#0E2A25] dark:fill-[#E3F1EC]" />
    </svg>
  );
}
