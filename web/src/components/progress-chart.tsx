import { formatNumber } from '@/lib/units';
import type { ProgressPoint } from '@/lib/progress';

import { LocalTime } from './local-time';

const W = 320;
const H = 140;
const PAD = { top: 12, right: 8, bottom: 8, left: 8 };

/** A small line chart of one value per workout. Plain SVG; spaced by date. */
export function ProgressChart({ points, label }: { points: ProgressPoint[]; label: string }) {
  if (points.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">Log this exercise in two workouts to see a trend.</p>
    );
  }
  const t0 = points[0]!.date.getTime();
  const t1 = points.at(-1)!.date.getTime();
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - (lo - span * 0.1)) / (span * 1.2)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date.getTime()).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points.at(-1)!;

  return (
    <figure className="space-y-1">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{formatNumber(last.value)}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="text-foreground h-auto w-full"
        role="img"
        aria-label={`${label}: from ${formatNumber(points[0]!.value)} to ${formatNumber(last.value)} over ${points.length} workouts`}
      >
        <line x1={PAD.left} x2={W - PAD.right} y1={y(hi)} y2={y(hi)} className="stroke-border" strokeDasharray="3 3" />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(lo)} y2={y(lo)} className="stroke-border" strokeDasharray="3 3" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.date.getTime())} cy={y(p.value)} r={2.5} fill="currentColor">
            <title>{formatNumber(p.value)}</title>
          </circle>
        ))}
      </svg>
      <div className="text-muted-foreground flex justify-between text-xs">
        <LocalTime date={points[0]!.date} format="short" />
        <span>
          {formatNumber(lo)} – {formatNumber(hi)}
        </span>
        <LocalTime date={last.date} format="short" />
      </div>
    </figure>
  );
}
