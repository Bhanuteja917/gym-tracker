export const WEIGHT_UNITS = ['lb', 'kg'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const KG_PER_LB = 0.45359237;

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'lb' || value === 'kg';
}

export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  return from === 'lb' ? weight * KG_PER_LB : weight / KG_PER_LB;
}

export function toKg(weight: number, unit: WeightUnit): number {
  return convertWeight(weight, unit, 'kg');
}

/** Rounds to at most `decimals` places and drops trailing zeros: 135 → "135", 61.235 → "61.2". */
export function formatNumber(value: number, decimals = 1): string {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

/**
 * Formats a stored weight. When `displayUnit` differs from the unit it was
 * entered in, the value is converted and rounded; otherwise it is shown exactly.
 */
export function formatWeight(
  weight: number | null,
  unit: WeightUnit,
  displayUnit: WeightUnit = unit,
): string {
  if (weight === null) return 'BW';
  const value = convertWeight(weight, unit, displayUnit);
  return `${unit === displayUnit ? String(value) : formatNumber(value)} ${displayUnit}`;
}

/** "135 lb × 8", "BW × 12", with " @8" when RPE is set. */
export function formatSet(
  set: { weight: number | null; unit: WeightUnit; reps: number; rpe?: number | null },
  displayUnit?: WeightUnit,
): string {
  const rpe = set.rpe != null ? ` @${set.rpe}` : '';
  return `${formatWeight(set.weight, set.unit, displayUnit)} × ${set.reps}${rpe}`;
}
