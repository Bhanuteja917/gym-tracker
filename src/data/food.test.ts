import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import {
  addFoodEntry,
  dayTotals,
  deleteFoodEntry,
  deleteSavedFood,
  getFoodEntry,
  InvalidFoodError,
  listFoodEntries,
  listSavedFoods,
  saveFood,
  updateFoodEntry,
  updateSavedFood,
  type FoodInput,
} from './food';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

const food = (name: string, calories: number, macros: Partial<FoodInput> = {}): FoodInput => ({
  name,
  calories,
  protein: null,
  carbs: null,
  fat: null,
  ...macros,
});

describe('food entries', () => {
  it('lists entries for one day in the order logged', () => {
    addFoodEntry(db, '2026-10-01', food('Lunch', 650), {}, 2000);
    addFoodEntry(db, '2026-10-01', food('Breakfast', 400), {}, 1000);
    addFoodEntry(db, '2026-09-30', food('Dinner', 800), {}, 500);
    expect(listFoodEntries(db, '2026-10-01').map((e) => e.name)).toEqual(['Breakfast', 'Lunch']);
    expect(listFoodEntries(db, '2026-09-30').map((e) => e.name)).toEqual(['Dinner']);
  });

  it('totals calories and only the macros that were logged', () => {
    addFoodEntry(db, '2026-10-01', food('Shake', 300, { protein: 40, carbs: 10 }));
    addFoodEntry(db, '2026-10-01', food('Apple', 95, { carbs: 25 }));
    addFoodEntry(db, '2026-10-01', food('Coffee', 5));
    expect(dayTotals(db, '2026-10-01')).toEqual({ calories: 400, protein: 40, carbs: 35, fat: null });
    expect(dayTotals(db, '2026-10-02')).toEqual({ calories: 0, protein: null, carbs: null, fat: null });
  });

  it('trims names and rejects invalid input', () => {
    expect(addFoodEntry(db, '2026-10-01', food('  Toast ', 120)).name).toBe('Toast');
    expect(() => addFoodEntry(db, '2026-10-01', food('  ', 120))).toThrow(InvalidFoodError);
    expect(() => addFoodEntry(db, '2026-10-01', food('X', 1.5))).toThrow(InvalidFoodError);
    expect(() => addFoodEntry(db, '2026-10-01', food('X', 20001))).toThrow(InvalidFoodError);
    expect(() => addFoodEntry(db, '2026-10-01', food('X', 10, { fat: -1 }))).toThrow(InvalidFoodError);
    expect(() => addFoodEntry(db, '2026-13-01', food('X', 10))).toThrow(InvalidFoodError);
  });

  it('edits and deletes entries', () => {
    const e = addFoodEntry(db, '2026-10-01', food('Lunch', 650));
    updateFoodEntry(db, e.id, food('Big lunch', 900, { protein: 50 }));
    expect(getFoodEntry(db, e.id)).toMatchObject({ name: 'Big lunch', calories: 900, protein: 50 });
    deleteFoodEntry(db, e.id);
    expect(getFoodEntry(db, e.id)).toBeUndefined();
  });
});

describe('saved foods', () => {
  it('saves a food while logging, updating an existing one by name (any case)', () => {
    addFoodEntry(db, '2026-10-01', food('Protein Shake', 300, { protein: 40 }), { saveAsFood: true });
    addFoodEntry(db, '2026-10-02', food('protein shake', 320, { protein: 45 }), { saveAsFood: true });
    const saved = listSavedFoods(db);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'protein shake', calories: 320, protein: 45 });
  });

  it('copies values into entries, so editing or deleting a saved food leaves history alone', () => {
    const shake = saveFood(db, food('Shake', 300));
    const entry = addFoodEntry(db, '2026-10-01', food(shake.name, shake.calories));
    updateSavedFood(db, shake.id, food('Shake', 350));
    deleteSavedFood(db, shake.id);
    expect(getFoodEntry(db, entry.id)).toMatchObject({ name: 'Shake', calories: 300 });
  });

  it('searches by name, sorted case-insensitively', () => {
    saveFood(db, food('banana', 105));
    saveFood(db, food('Apple', 95));
    saveFood(db, food('Banana bread', 200));
    expect(listSavedFoods(db).map((f) => f.name)).toEqual(['Apple', 'banana', 'Banana bread']);
    expect(listSavedFoods(db, ' BAN ').map((f) => f.name)).toEqual(['banana', 'Banana bread']);
  });

  it('refuses to rename a saved food onto another one', () => {
    saveFood(db, food('Apple', 95));
    const pear = saveFood(db, food('Pear', 100));
    expect(() => updateSavedFood(db, pear.id, food('apple', 100))).toThrow(
      'A saved food with that name already exists',
    );
  });
});
