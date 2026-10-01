import { asc, eq, sql } from 'drizzle-orm';

import { foodEntries, savedFoods, type FoodEntry, type SavedFood } from '@/db/schema';
import type { DB } from '@/db/types';
import { parseDayKey, type DayKey } from '@/lib/dot-grid';
import { MAX_CALORIES, type Macros } from '@/lib/nutrition';

export type FoodInput = { name: string; calories: number } & Macros;

export class InvalidFoodError extends Error {}

function clean(input: FoodInput): FoodInput {
  const name = input.name.trim();
  if (name === '') throw new InvalidFoodError('Name is required');
  if (!Number.isInteger(input.calories) || input.calories < 0 || input.calories > MAX_CALORIES) {
    throw new InvalidFoodError(`Calories must be a whole number from 0 to ${MAX_CALORIES}`);
  }
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    const value = input[key];
    if (value !== null && !(Number.isFinite(value) && value >= 0)) {
      throw new InvalidFoodError(`${key[0].toUpperCase()}${key.slice(1)} must be 0 or more`);
    }
  }
  return { name, calories: input.calories, protein: input.protein, carbs: input.carbs, fat: input.fat };
}

// ---- Entries ----------------------------------------------------------------

export function listFoodEntries(db: DB, day: DayKey): FoodEntry[] {
  return db
    .select()
    .from(foodEntries)
    .where(eq(foodEntries.day, day))
    .orderBy(asc(foodEntries.loggedAt), asc(foodEntries.id))
    .all();
}

export function getFoodEntry(db: DB, id: number): FoodEntry | undefined {
  return db.select().from(foodEntries).where(eq(foodEntries.id, id)).get();
}

export type DayTotals = { calories: number } & Macros;

/** A macro total is null when no entry that day has a value for it. */
export function dayTotals(db: DB, day: DayKey): DayTotals {
  const entries = listFoodEntries(db, day);
  const sum = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null);
    return present.length > 0 ? present.reduce((a, b) => a + b, 0) : null;
  };
  return {
    calories: entries.reduce((n, e) => n + e.calories, 0),
    protein: sum(entries.map((e) => e.protein)),
    carbs: sum(entries.map((e) => e.carbs)),
    fat: sum(entries.map((e) => e.fat)),
  };
}

/** Logs food on `day`. With `saveAsFood`, also saves (or updates, by name) a reusable food. */
export function addFoodEntry(
  db: DB,
  day: DayKey,
  input: FoodInput,
  { saveAsFood = false }: { saveAsFood?: boolean } = {},
  now = Date.now(),
): FoodEntry {
  if (!parseDayKey(day)) throw new InvalidFoodError(`Invalid day: ${day}`);
  const values = clean(input);
  if (saveAsFood) saveFood(db, values);
  return db
    .insert(foodEntries)
    .values({ ...values, day, loggedAt: now })
    .returning()
    .get();
}

export function updateFoodEntry(db: DB, id: number, input: FoodInput): void {
  db.update(foodEntries).set(clean(input)).where(eq(foodEntries.id, id)).run();
}

export function deleteFoodEntry(db: DB, id: number): void {
  db.delete(foodEntries).where(eq(foodEntries.id, id)).run();
}

// ---- Saved foods --------------------------------------------------------------

function findSavedFoodByName(db: DB, name: string): SavedFood | undefined {
  return db
    .select()
    .from(savedFoods)
    .where(sql`lower(${savedFoods.name}) = lower(${name})`)
    .get();
}

/** Saved foods sorted by name, optionally filtered by a case-insensitive substring. */
export function listSavedFoods(db: DB, query = ''): SavedFood[] {
  const all = db
    .select()
    .from(savedFoods)
    .orderBy(sql`lower(${savedFoods.name})`)
    .all();
  const q = query.trim().toLowerCase();
  return q === '' ? all : all.filter((f) => f.name.toLowerCase().includes(q));
}

export function getSavedFood(db: DB, id: number): SavedFood | undefined {
  return db.select().from(savedFoods).where(eq(savedFoods.id, id)).get();
}

/** Saves a food, replacing the values of an existing one with the same name (any case). */
export function saveFood(db: DB, input: FoodInput): SavedFood {
  const values = clean(input);
  const existing = findSavedFoodByName(db, values.name);
  if (existing) {
    return db.update(savedFoods).set(values).where(eq(savedFoods.id, existing.id)).returning().get();
  }
  return db.insert(savedFoods).values(values).returning().get();
}

export function updateSavedFood(db: DB, id: number, input: FoodInput): void {
  const values = clean(input);
  const clash = findSavedFoodByName(db, values.name);
  if (clash && clash.id !== id) {
    throw new InvalidFoodError('A saved food with that name already exists');
  }
  db.update(savedFoods).set(values).where(eq(savedFoods.id, id)).run();
}

export function deleteSavedFood(db: DB, id: number): void {
  db.delete(savedFoods).where(eq(savedFoods.id, id)).run();
}
