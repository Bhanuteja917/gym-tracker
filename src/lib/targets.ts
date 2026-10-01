import type { WeightUnit } from '@/db/schema';
import { formatWeight } from '@/lib/units';

/** Planned targets on a plan exercise or (snapshotted) on a workout exercise. */
export type Targets = {
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetUnit: WeightUnit | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "3 × 8 @ 135 lb", "3 sets", "8 reps @ 60 kg", "@ 135 lb"; null when nothing is set. */
export function formatTargets(t: Targets): string | null {
  const count =
    t.targetSets !== null && t.targetReps !== null
      ? `${t.targetSets} × ${t.targetReps}`
      : t.targetSets !== null
        ? plural(t.targetSets, 'set')
        : t.targetReps !== null
          ? plural(t.targetReps, 'rep')
          : null;
  const weight =
    t.targetWeight !== null ? `@ ${formatWeight(t.targetWeight, t.targetUnit ?? 'lb')}` : null;
  const parts = [count, weight].filter((p) => p !== null);
  return parts.length > 0 ? parts.join(' ') : null;
}
