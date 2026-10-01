import { formatNumber, type ParseResult } from '@/lib/units';

export const MAX_CALORIES = 20_000;

/** Required whole number of kcal, 0–20,000. */
export function parseCalories(input: string): ParseResult<number> {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, error: 'Calories are required' };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'Calories must be a whole number' };
  const value = Number(trimmed);
  if (value > MAX_CALORIES) return { ok: false, error: 'Calories look too large' };
  return { ok: true, value };
}

/** Optional grams of a macro (empty → null), 0 or more. */
export function parseMacro(input: string, label: string): ParseResult<number | null> {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(trimmed)) return { ok: false, error: `${label} must be a number` };
  const value = Number(trimmed);
  if (value > 2000) return { ok: false, error: `${label} looks too large` };
  return { ok: true, value };
}

/** 1450 → "1,450". */
export function formatKcal(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export type Macros = { protein: number | null; carbs: number | null; fat: number | null };

/** Daily targets; null means no target. */
export type NutritionTargets = { calories: number | null } & Macros;

/** "P 30 · C 45.6 · F 12", skipping missing values; undefined when none are set. */
export function macroSummary(m: Macros): string | undefined {
  const parts = (
    [
      ['P', m.protein],
      ['C', m.carbs],
      ['F', m.fat],
    ] as const
  )
    .filter(([, v]) => v !== null)
    .map(([label, v]) => `${label} ${formatNumber(v!)}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

const MACRO_ROWS = [
  ['Protein', 'protein'],
  ['Carbs', 'carbs'],
  ['Fat', 'fat'],
] as const;

/** One line per macro that has a target or a logged value, e.g. "Protein 120 / 150 g". */
export function macroLines(totals: Macros, targets: NutritionTargets): string[] {
  return MACRO_ROWS.filter(([, key]) => totals[key] !== null || targets[key] !== null).map(
    ([label, key]) =>
      `${label} ${formatNumber(totals[key] ?? 0)}${targets[key] !== null ? ` / ${targets[key]}` : ''} g`,
  );
}

/** "750 kcal left" / "120 kcal over", or null without a target. */
export function calorieStatus(eaten: number, target: number | null): string | null {
  if (target === null) return null;
  const diff = target - eaten;
  return diff >= 0 ? `${formatKcal(diff)} kcal left` : `${formatKcal(-diff)} kcal over`;
}
