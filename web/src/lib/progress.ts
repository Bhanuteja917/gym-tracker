import { convertWeight, toKg, type WeightUnit } from './units';

type SetLike = { weight: number | null; unit: WeightUnit; reps: number | null; durationSec?: number | null };

/**
 * Estimated one-rep max (Epley), in the set's own unit. A single is its own
 * 1RM. Null for bodyweight sets and for sets over 12 reps, where the formula
 * stops being meaningful, and for timed sets without reps.
 */
export function estimatedOneRepMax(set: SetLike): number | null {
  if (set.weight === null || set.weight <= 0 || set.reps === null || set.reps < 1 || set.reps > 12) return null;
  if (set.reps === 1) return set.weight;
  return set.weight * (1 + set.reps / 30);
}

/**
 * Best set: the heaviest weight (compared in kg so lb and kg sets mix), then
 * the most reps, then the longest time. Bodyweight sets only win when there
 * are no weighted sets.
 */
export function bestSet<T extends SetLike>(sets: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const set of sets) {
    if (!best) {
      best = set;
      continue;
    }
    const a = set.weight === null ? -1 : toKg(set.weight, set.unit);
    const b = best.weight === null ? -1 : toKg(best.weight, best.unit);
    const more = (set.reps ?? 0) - (best.reps ?? 0) || (set.durationSec ?? 0) - (best.durationSec ?? 0);
    if (a > b + 1e-9 || (Math.abs(a - b) <= 1e-9 && more > 0)) best = set;
  }
  return best;
}

/** Total weight × reps, in kg. Bodyweight and timed-only sets count as zero. */
export function volumeKg(sets: readonly SetLike[]): number {
  return sets.reduce((sum, s) => sum + (s.weight === null ? 0 : toKg(s.weight, s.unit) * (s.reps ?? 0)), 0);
}

export type ProgressPoint = { date: Date; value: number };

export type ProgressMetric = 'e1rm' | 'reps' | 'time';

/**
 * One point per workout, oldest first: the best estimated 1RM in `unit`; for
 * exercises never done with weight, the most reps in a set; for timed-only
 * exercises, the longest set in seconds.
 */
export function progressSeries(
  sessions: readonly { startedAt: Date; sets: readonly SetLike[] }[],
  unit: WeightUnit,
): { metric: ProgressMetric; points: ProgressPoint[] } {
  const all = sessions.flatMap((s) => s.sets);
  const metric: ProgressMetric = all.some((set) => estimatedOneRepMax(set) !== null)
    ? 'e1rm'
    : all.some((set) => set.reps !== null) || !all.some((set) => set.durationSec != null)
      ? 'reps'
      : 'time';
  const valueOf = (set: SetLike): number | null => {
    if (metric === 'reps') return set.reps;
    if (metric === 'time') return set.durationSec ?? null;
    const e = estimatedOneRepMax(set);
    return e === null ? null : convertWeight(e, set.unit, unit);
  };
  const points: ProgressPoint[] = [];
  for (const session of [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
    let value: number | null = null;
    for (const set of session.sets) {
      const v = valueOf(set);
      if (v !== null && (value === null || v > value)) value = v;
    }
    if (value !== null) points.push({ date: session.startedAt, value });
  }
  return { metric, points };
}
