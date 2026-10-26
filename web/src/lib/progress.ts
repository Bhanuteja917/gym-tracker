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
  const metric = progressMetric(sessions.flatMap((s) => s.sets));
  const points: ProgressPoint[] = [];
  for (const session of [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
    const value = bestValue(session.sets, metric, unit);
    if (value !== null) points.push({ date: session.startedAt, value });
  }
  return { metric, points };
}

/** What to compare an exercise's workouts by: see progressSeries. */
function progressMetric(sets: readonly SetLike[]): ProgressMetric {
  if (sets.some((set) => estimatedOneRepMax(set) !== null)) return 'e1rm';
  return sets.some((set) => set.reps !== null) || !sets.some((set) => set.durationSec != null) ? 'reps' : 'time';
}

/** A workout's best value for the metric, in `unit` for e1RM; null if no set has one. */
function bestValue(sets: readonly SetLike[], metric: ProgressMetric, unit: WeightUnit): number | null {
  let best: number | null = null;
  for (const set of sets) {
    let v: number | null;
    if (metric === 'reps') v = set.reps;
    else if (metric === 'time') v = set.durationSec ?? null;
    else {
      const e = estimatedOneRepMax(set);
      v = e === null ? null : convertWeight(e, set.unit, unit);
    }
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
}

export type OrderStat = { label: string; workouts: number; average: number };

const ORDINALS = ['1st', '2nd', '3rd'];

/**
 * How an exercise goes depending on where it comes in the workout: the
 * average of each workout's best value (as in progressSeries) by its place
 * (1st, 2nd, 3rd, 4th or later) and by the exercise done just before it.
 */
export function orderEffect(
  sessions: readonly { order: number; after: string | null; sets: readonly SetLike[] }[],
  unit: WeightUnit,
): { metric: ProgressMetric; byOrder: OrderStat[]; byPrevious: OrderStat[] } {
  const metric = progressMetric(sessions.flatMap((s) => s.sets));
  const byOrder = new Map<number, number[]>();
  const byPrevious = new Map<string, number[]>();
  for (const s of sessions) {
    const value = bestValue(s.sets, metric, unit);
    if (value === null) continue;
    const bucket = Math.min(s.order, ORDINALS.length + 1);
    byOrder.set(bucket, [...(byOrder.get(bucket) ?? []), value]);
    if (s.after !== null) byPrevious.set(s.after, [...(byPrevious.get(s.after) ?? []), value]);
  }
  const stat = (label: string, values: number[]): OrderStat => ({
    label,
    workouts: values.length,
    average: values.reduce((a, b) => a + b, 0) / values.length,
  });
  return {
    metric,
    byOrder: [...byOrder]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, values]) => stat(ORDINALS[bucket - 1] ?? `${bucket}th or later`, values)),
    byPrevious: [...byPrevious]
      .map(([name, values]) => stat(name, values))
      .sort((a, b) => b.workouts - a.workouts || a.label.localeCompare(b.label)),
  };
}
