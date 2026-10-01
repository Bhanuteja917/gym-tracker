import type { WeightUnit } from '@/db/schema';

export const KG_PER_LB = 0.45359237;

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

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parses a weight field. Empty input means bodyweight (null). */
export function parseWeight(input: string): ParseResult<number | null> {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(trimmed)) return { ok: false, error: 'Weight must be a number' };
  const value = Number(trimmed);
  if (value > 2000) return { ok: false, error: 'Weight looks too large' };
  return { ok: true, value };
}

export function parseReps(input: string): ParseResult<number> {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'Reps must be a whole number' };
  const value = Number(trimmed);
  if (value < 1) return { ok: false, error: 'Reps must be at least 1' };
  if (value > 1000) return { ok: false, error: 'Reps looks too large' };
  return { ok: true, value };
}

/** RPE is optional (empty → null) and must be between 1 and 10 in half steps. */
export function parseRpe(input: string): ParseResult<number | null> {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return { ok: true, value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1 || value > 10 || (value * 2) % 1 !== 0) {
    return { ok: false, error: 'RPE must be 1–10 (half steps allowed)' };
  }
  return { ok: true, value };
}

/** Optional whole number from 1 to `max` (empty → null), e.g. planned sets or a daily target. */
export function parseOptionalCount(
  input: string,
  label: string,
  max = 1000,
): ParseResult<number | null> {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return { ok: false, error: `${label} must be a whole number of at least 1` };
  }
  const value = Number(trimmed);
  if (value > max) return { ok: false, error: `${label} looks too large` };
  return { ok: true, value };
}
