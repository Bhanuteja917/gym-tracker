import { convertWeight, toKg, type WeightUnit } from './units';

type SetLike = { weight: number | null; unit: WeightUnit; reps: number };

/**
 * Estimated one-rep max (Epley), in the set's own unit. A single is its own
 * 1RM. Null for bodyweight sets and for sets over 12 reps, where the formula
 * stops being meaningful.
 */
export function estimatedOneRepMax(set: SetLike): number | null {
  if (set.weight === null || set.weight <= 0 || set.reps < 1 || set.reps > 12) return null;
  if (set.reps === 1) return set.weight;
  return set.weight * (1 + set.reps / 30);
}

/**
 * Best set: the heaviest weight (compared in kg so lb and kg sets mix), then
 * the most reps. Bodyweight sets only win when there are no weighted sets.
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
    if (a > b + 1e-9 || (Math.abs(a - b) <= 1e-9 && set.reps > best.reps)) best = set;
  }
  return best;
}

/** Total weight × reps, in kg. Bodyweight sets count as zero. */
export function volumeKg(sets: readonly SetLike[]): number {
  return sets.reduce((sum, s) => sum + (s.weight === null ? 0 : toKg(s.weight, s.unit) * s.reps), 0);
}

export type ProgressPoint = { date: Date; value: number };

/**
 * One point per workout, oldest first: the best estimated 1RM in `unit`, or,
 * for exercises never done with weight, the most reps in a set.
 */
export function progressSeries(
  sessions: readonly { startedAt: Date; sets: readonly SetLike[] }[],
  unit: WeightUnit,
): { metric: 'e1rm' | 'reps'; points: ProgressPoint[] } {
  const weighted = sessions.some((s) => s.sets.some((set) => estimatedOneRepMax(set) !== null));
  const points: ProgressPoint[] = [];
  for (const session of [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
    let value: number | null = null;
    for (const set of session.sets) {
      const v = weighted
        ? (() => {
            const e = estimatedOneRepMax(set);
            return e === null ? null : convertWeight(e, set.unit, unit);
          })()
        : set.reps;
      if (v !== null && (value === null || v > value)) value = v;
    }
    if (value !== null) points.push({ date: session.startedAt, value });
  }
  return { metric: weighted ? 'e1rm' : 'reps', points };
}
