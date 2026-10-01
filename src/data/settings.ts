import { eq } from 'drizzle-orm';

import { settings, WEIGHT_UNITS, type WeightUnit } from '@/db/schema';
import type { DB } from '@/db/types';
import { parseDayKey, type DayKey } from '@/lib/dot-grid';
import type { NutritionTargets } from '@/lib/nutrition';

const DEFAULT_UNIT_KEY = 'default_unit';

export function getDefaultUnit(db: DB): WeightUnit {
  const row = db.select().from(settings).where(eq(settings.key, DEFAULT_UNIT_KEY)).get();
  return WEIGHT_UNITS.find((u) => u === row?.value) ?? 'lb';
}

export function setDefaultUnit(db: DB, unit: WeightUnit): void {
  setValue(db, DEFAULT_UNIT_KEY, unit);
}

/** How far back the home-screen attendance grid reaches. */
export const ATTENDANCE_RANGES = ['3m', '6m'] as const;
export type AttendanceRange = (typeof ATTENDANCE_RANGES)[number];

const ATTENDANCE_RANGE_KEY = 'attendance_range';

export function getAttendanceRange(db: DB): AttendanceRange {
  const row = db.select().from(settings).where(eq(settings.key, ATTENDANCE_RANGE_KEY)).get();
  return ATTENDANCE_RANGES.find((r) => r === row?.value) ?? '3m';
}

export function setAttendanceRange(db: DB, range: AttendanceRange): void {
  setValue(db, ATTENDANCE_RANGE_KEY, range);
}

const ATTENDANCE_START_KEY = 'attendance_start';

/** Start of a fixed attendance window as `YYYY-MM-DD`, or null for "ending today". */
export function getAttendanceStart(db: DB): DayKey | null {
  const row = db.select().from(settings).where(eq(settings.key, ATTENDANCE_START_KEY)).get();
  return row && parseDayKey(row.value) ? row.value : null;
}

export function setAttendanceStart(db: DB, start: DayKey | null): void {
  if (start === null) {
    db.delete(settings).where(eq(settings.key, ATTENDANCE_START_KEY)).run();
  } else {
    setValue(db, ATTENDANCE_START_KEY, start);
  }
}

const NUTRITION_KEYS = {
  calories: 'calorie_target',
  protein: 'protein_target',
  carbs: 'carbs_target',
  fat: 'fat_target',
} as const satisfies Record<keyof NutritionTargets, string>;

/** Daily nutrition targets; null where none is set. */
export function getNutritionTargets(db: DB): NutritionTargets {
  const values = new Map(db.select().from(settings).all().map((r) => [r.key, r.value]));
  const read = (key: string) => {
    const n = Number(values.get(key));
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  return {
    calories: read(NUTRITION_KEYS.calories),
    protein: read(NUTRITION_KEYS.protein),
    carbs: read(NUTRITION_KEYS.carbs),
    fat: read(NUTRITION_KEYS.fat),
  };
}

export function setNutritionTarget(
  db: DB,
  which: keyof NutritionTargets,
  value: number | null,
): void {
  const key = NUTRITION_KEYS[which];
  if (value === null) db.delete(settings).where(eq(settings.key, key)).run();
  else setValue(db, key, String(value));
}

function setValue(db: DB, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}
