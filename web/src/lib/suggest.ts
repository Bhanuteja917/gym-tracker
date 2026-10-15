import type { WeightUnit } from './units';

type SetLike = { weight: number | null; unit: WeightUnit; reps: number };

/**
 * What to pre-fill for the next set: the previous set in this workout, else
 * the matching set from last time, else blank in the default unit.
 */
export function suggestNextSet(
  current: readonly SetLike[],
  lastTime: readonly SetLike[] | undefined,
  defaultUnit: WeightUnit,
): { weight: number | null; unit: WeightUnit; reps: number | null } {
  const source = current.at(-1) ?? lastTime?.[current.length] ?? lastTime?.at(-1);
  if (!source) return { weight: null, unit: defaultUnit, reps: null };
  return { weight: source.weight, unit: source.unit, reps: source.reps };
}
