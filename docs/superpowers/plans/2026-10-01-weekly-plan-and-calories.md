# Weekly Plan and Calorie Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeating Mon–Sun workout plan with per-exercise targets that can start pre-filled workouts, and a daily calorie/macro log with targets and saved foods.

**Architecture:** New Drizzle tables (one migration `0002`) plus synchronous data modules in `src/data/` (`plan.ts`, `food.ts`, additions to `workouts.ts`, `settings.ts`, `backup.ts`), pure helpers in `src/lib/`, and Expo Router screens that read via `useDbQuery`. Tabs become Workout · Plan · Food · History · Settings; the Exercises screen moves under Settings.

**Tech Stack:** Expo SDK 57, Expo Router (NativeTabs, typed routes), expo-sqlite + Drizzle ORM 0.45, Jest (jest-expo/node) with in-memory better-sqlite3.

**Spec:** `docs/superpowers/specs/2026-10-01-weekly-plan-and-calories-design.md`

## Global Constraints

- Local SQLite only; no network, no accounts, no new dependencies (`Switch` comes from `react-native`).
- Business rules and queries live in `src/data/` as synchronous functions taking a `DB`; screens call them directly and read with `useDbQuery`.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`; never edit an existing migration (`0000_init`, `0001_seed_exercises`).
- Weights are stored as entered with their unit; convert only for display.
- Weekday numbering: Monday = 1 … Sunday = 7.
- Food `day` is a local `YYYY-MM-DD` string (`DayKey` from `src/lib/dot-grid.ts`).
- Calories: integer 0–20,000, required. Protein/carbs/fat: number ≥ 0 or null.
- Nutrition targets: positive integers or unset. Plan target sets/reps: positive integers or null; target weight ≥ 0 or null.
- Logging from a saved food copies values; plan targets are snapshotted into `session_exercise` when a workout starts.
- Backup JSON is version 2; version 1 files must still restore.
- Commit directly on `main`. Every commit message ends with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Run `npm run check` (typecheck, lint, tests) before every commit.
- Typed routes are on (`app.json` → `experiments.typedRoutes`). If `npm run typecheck` rejects a new route string, regenerate `.expo/types` by starting the dev server once (`preview_start` with the project's launch config, or `npx expo start` then quit) and re-run.

## File Map

| File | Responsibility |
|---|---|
| `src/lib/days.ts` (new) | `Weekday` type, names, `weekdayOf`, `isWeekday`, `shiftDayKey`, `formatDayKey` |
| `src/lib/nutrition.ts` (new) | Calorie/macro parsing, `NutritionTargets` type, formatting helpers |
| `src/lib/targets.ts` (new) | `formatTargets` for plan/session targets |
| `src/lib/units.ts` | + `parseOptionalCount` |
| `src/db/schema.ts` | + `plan_day`, `plan_exercise`, `food_entry`, `saved_food`; new columns on `session`, `session_exercise` |
| `drizzle/0002_*.sql` (generated) | Migration |
| `src/data/plan.ts` (new) | Weekly plan CRUD, `describePlanDay` |
| `src/data/workouts.ts` | + `startPlannedSession`, `suggestedSetValues` |
| `src/data/food.ts` (new) | Food entries, day totals, saved foods |
| `src/data/settings.ts` | + nutrition targets |
| `src/data/backup.ts` | Version 2 with new tables; v1 upgrade |
| `src/app/(tabs)/_layout.tsx` | Tabs: Workout · Plan · Food · History · Settings |
| `src/app/(tabs)/plan.tsx` (new) | Week list |
| `src/app/plan/[weekday].tsx` (new) | Day editor |
| `src/app/plan-exercise/[id].tsx` (new) | Targets modal |
| `src/app/add-exercise.tsx` | Plan mode via `weekday` param |
| `src/app/exercises.tsx` (moved from `(tabs)/exercises.tsx`) | Exercise list, now a pushed screen |
| `src/components/today-plan-card.tsx` (new) | Workout tab start card |
| `src/components/exercise-card.tsx` | Target line + new pre-fill |
| `src/app/(tabs)/food.tsx` (new) | Daily food log |
| `src/components/food-form.tsx` (new) | Shared food fields |
| `src/app/food/new.tsx`, `src/app/food/[id].tsx` (new) | Add / edit entry modals |
| `src/app/foods.tsx`, `src/app/saved-food/[id].tsx` (new) | Saved foods list / edit |
| `src/components/target-field.tsx` (new) | Settings target input |
| `src/app/(tabs)/settings.tsx` | Nutrition targets + Library rows |
| `src/app/_layout.tsx` | Register new stack screens |
| `docs/PLAN.md` | Data model, layout, milestones |

---

### Task 1: Pure helpers (days, nutrition, targets, optional counts)

**Files:**
- Create: `src/lib/days.ts`, `src/lib/days.test.ts`
- Create: `src/lib/nutrition.ts`, `src/lib/nutrition.test.ts`
- Create: `src/lib/targets.ts`, `src/lib/targets.test.ts`
- Modify: `src/lib/units.ts` (append `parseOptionalCount`), `src/lib/units.test.ts`

**Interfaces:**
- Consumes: `dayKey`, `parseDayKey`, `DayKey` from `src/lib/dot-grid.ts`; `formatNumber`, `formatWeight`, `ParseResult` from `src/lib/units.ts`.
- Produces:
  - `type Weekday = 1|2|3|4|5|6|7`; `WEEKDAYS: readonly Weekday[]`; `WEEKDAY_NAMES: Record<Weekday, string>`; `isWeekday(n: number): n is Weekday`; `weekdayOf(date: Date): Weekday`; `shiftDayKey(key: DayKey, n: number): DayKey`; `formatDayKey(key: DayKey, today?: Date): string`
  - `MAX_CALORIES = 20000`; `parseCalories(s): ParseResult<number>`; `parseMacro(s, label): ParseResult<number|null>`; `formatKcal(n): string`; `type Macros`; `type NutritionTargets = { calories: number|null } & Macros`; `macroSummary(m: Macros): string|undefined`; `macroLines(totals: Macros, targets: NutritionTargets): string[]`; `calorieStatus(eaten: number, target: number|null): string|null`
  - `type Targets = { targetSets; targetReps; targetWeight: number|null; targetUnit: WeightUnit|null }`; `formatTargets(t: Targets): string|null`
  - `parseOptionalCount(input: string, label: string, max = 1000): ParseResult<number|null>`

- [ ] **Step 1: Write the failing tests**

`src/lib/days.test.ts`:
```ts
import { formatDayKey, isWeekday, shiftDayKey, weekdayOf } from './days';

describe('weekdayOf', () => {
  it('numbers Monday 1 through Sunday 7', () => {
    expect(weekdayOf(new Date(2026, 8, 28))).toBe(1); // Mon 28 Sep 2026
    expect(weekdayOf(new Date(2026, 9, 1, 0, 30))).toBe(4); // Thu
    expect(weekdayOf(new Date(2026, 9, 4, 23, 59))).toBe(7); // Sun
  });
});

describe('isWeekday', () => {
  it('accepts only whole numbers 1–7', () => {
    expect(isWeekday(1)).toBe(true);
    expect(isWeekday(7)).toBe(true);
    expect(isWeekday(0)).toBe(false);
    expect(isWeekday(8)).toBe(false);
    expect(isWeekday(1.5)).toBe(false);
    expect(isWeekday(NaN)).toBe(false);
  });
});

describe('shiftDayKey', () => {
  it('rolls over months, years and leap days', () => {
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDayKey('2026-10-01', 0)).toBe('2026-10-01');
  });

  it('throws on an invalid key', () => {
    expect(() => shiftDayKey('nope', 1)).toThrow('Invalid day');
  });
});

describe('formatDayKey', () => {
  const today = new Date(2026, 9, 1, 9, 0);

  it('names nearby days', () => {
    expect(formatDayKey('2026-10-01', today)).toBe('Today');
    expect(formatDayKey('2026-09-30', today)).toBe('Yesterday');
    expect(formatDayKey('2026-10-02', today)).toBe('Tomorrow');
  });

  it('shows weekday, month and day, adding the year when it differs', () => {
    expect(formatDayKey('2026-09-28', today)).toBe('Mon, Sep 28');
    expect(formatDayKey('2025-12-25', today)).toBe('Thu, Dec 25, 2025');
  });
});
```

`src/lib/nutrition.test.ts`:
```ts
import {
  calorieStatus,
  formatKcal,
  macroLines,
  macroSummary,
  parseCalories,
  parseMacro,
} from './nutrition';

describe('parseCalories', () => {
  it('requires a whole number from 0 to 20,000', () => {
    expect(parseCalories(' 650 ')).toEqual({ ok: true, value: 650 });
    expect(parseCalories('0')).toEqual({ ok: true, value: 0 });
    expect(parseCalories('')).toEqual({ ok: false, error: 'Calories are required' });
    expect(parseCalories('12.5')).toEqual({ ok: false, error: 'Calories must be a whole number' });
    expect(parseCalories('-5')).toEqual({ ok: false, error: 'Calories must be a whole number' });
    expect(parseCalories('20001')).toEqual({ ok: false, error: 'Calories look too large' });
  });
});

describe('parseMacro', () => {
  it('is optional and accepts decimals', () => {
    expect(parseMacro('', 'Protein')).toEqual({ ok: true, value: null });
    expect(parseMacro('30', 'Protein')).toEqual({ ok: true, value: 30 });
    expect(parseMacro('12,5', 'Fat')).toEqual({ ok: true, value: 12.5 });
    expect(parseMacro('abc', 'Carbs')).toEqual({ ok: false, error: 'Carbs must be a number' });
    expect(parseMacro('2001', 'Carbs')).toEqual({ ok: false, error: 'Carbs looks too large' });
  });
});

describe('formatting', () => {
  it('adds thousands separators to kcal', () => {
    expect(formatKcal(950)).toBe('950');
    expect(formatKcal(1450)).toBe('1,450');
    expect(formatKcal(12345.6)).toBe('12,346');
  });

  it('summarises only the macros that are set', () => {
    expect(macroSummary({ protein: 30, carbs: 45.56, fat: null })).toBe('P 30 · C 45.6');
    expect(macroSummary({ protein: null, carbs: null, fat: null })).toBeUndefined();
  });

  it('lists macros that have a target or a logged value', () => {
    expect(
      macroLines(
        { protein: 120, carbs: null, fat: null },
        { calories: 2200, protein: 150, carbs: null, fat: 70 },
      ),
    ).toEqual(['Protein 120 / 150 g', 'Fat 0 / 70 g']);
    expect(
      macroLines(
        { protein: null, carbs: 80, fat: null },
        { calories: null, protein: null, carbs: null, fat: null },
      ),
    ).toEqual(['Carbs 80 g']);
  });

  it('describes calories left or over', () => {
    expect(calorieStatus(1450, 2200)).toBe('750 kcal left');
    expect(calorieStatus(2320, 2200)).toBe('120 kcal over');
    expect(calorieStatus(1450, null)).toBeNull();
  });
});
```

`src/lib/targets.test.ts`:
```ts
import { formatTargets } from './targets';

const none = { targetSets: null, targetReps: null, targetWeight: null, targetUnit: null };

describe('formatTargets', () => {
  it('formats full and partial targets', () => {
    expect(formatTargets({ targetSets: 3, targetReps: 8, targetWeight: 135, targetUnit: 'lb' })).toBe(
      '3 × 8 @ 135 lb',
    );
    expect(formatTargets({ ...none, targetSets: 3 })).toBe('3 sets');
    expect(formatTargets({ ...none, targetSets: 1 })).toBe('1 set');
    expect(formatTargets({ ...none, targetReps: 8, targetWeight: 60, targetUnit: 'kg' })).toBe(
      '8 reps @ 60 kg',
    );
    expect(formatTargets({ ...none, targetWeight: 135, targetUnit: 'lb' })).toBe('@ 135 lb');
  });

  it('returns null when nothing is set', () => {
    expect(formatTargets(none)).toBeNull();
  });
});
```

Append to `src/lib/units.test.ts` (and add `parseOptionalCount` to its import list):
```ts
describe('parseOptionalCount', () => {
  it('allows empty and whole numbers from 1 up to the max', () => {
    expect(parseOptionalCount('', 'Sets')).toEqual({ ok: true, value: null });
    expect(parseOptionalCount(' 3 ', 'Sets')).toEqual({ ok: true, value: 3 });
    expect(parseOptionalCount('0', 'Sets')).toEqual({
      ok: false,
      error: 'Sets must be a whole number of at least 1',
    });
    expect(parseOptionalCount('2.5', 'Reps')).toEqual({
      ok: false,
      error: 'Reps must be a whole number of at least 1',
    });
    expect(parseOptionalCount('1001', 'Reps')).toEqual({ ok: false, error: 'Reps looks too large' });
    expect(parseOptionalCount('2200', 'Calories', 20000)).toEqual({ ok: true, value: 2200 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib`
Expected: FAIL — cannot find modules `./days`, `./nutrition`, `./targets`; `parseOptionalCount` is not a function.

- [ ] **Step 3: Implement**

`src/lib/days.ts`:
```ts
import { dayKey, parseDayKey, type DayKey } from '@/lib/dot-grid';

/** ISO weekday: Monday = 1 … Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

export function weekdayOf(date: Date): Weekday {
  return (((date.getDay() + 6) % 7) + 1) as Weekday;
}

/** The day `n` days after `key` (negative for earlier). Throws on an invalid key. */
export function shiftDayKey(key: DayKey, n: number): DayKey {
  const date = parseDayKey(key);
  if (!date) throw new Error(`Invalid day: ${key}`);
  // Built from parts so daylight-saving changes can't skip or repeat a day.
  return dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + n));
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", "Tomorrow", or e.g. "Mon, Sep 28" (with the year when it isn't this year). */
export function formatDayKey(key: DayKey, today: Date = new Date()): string {
  const todayKey = dayKey(today);
  if (key === todayKey) return 'Today';
  if (key === shiftDayKey(todayKey, -1)) return 'Yesterday';
  if (key === shiftDayKey(todayKey, 1)) return 'Tomorrow';
  const date = parseDayKey(key);
  if (!date) return key;
  const label = `${SHORT_DAYS[date.getDay()]}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === today.getFullYear() ? label : `${label}, ${date.getFullYear()}`;
}
```

`src/lib/nutrition.ts`:
```ts
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
```

`src/lib/targets.ts`:
```ts
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
```

Append to `src/lib/units.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib`
Expected: PASS (all suites in `src/lib`).

- [ ] **Step 5: Check and commit**

```bash
npm run check
git add src/lib
git commit -m "Add day, nutrition and target helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema, migration and weekly plan data layer

**Files:**
- Modify: `src/db/schema.ts`
- Generated: `drizzle/0002_*.sql`, `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json`, `drizzle/migrations.js`
- Create: `src/data/plan.ts`, `src/data/plan.test.ts`

**Interfaces:**
- Consumes: `Weekday`, `WEEKDAYS` (Task 1); `getDefaultUnit(db)` from `src/data/settings.ts`; `createExercise`, `removeExercise` from `src/data/exercises.ts`.
- Produces:
  - Schema tables `planDays`, `planExercises`, `foodEntries`, `savedFoods`; types `PlanDayRow`, `PlanExercise`, `FoodEntry`, `SavedFood`.
  - `sessions.planWeekday: number|null`; `sessionExercises.targetSets/targetReps: number|null`, `targetWeight: number|null`, `targetUnit: WeightUnit|null`.
  - From `src/data/plan.ts`: `type PlannedExercise = PlanExercise & { exercise: Exercise }`; `type PlanDay = { weekday: Weekday; name: string|null; exercises: PlannedExercise[] }`; `type PlanTargets = { targetSets: number|null; targetReps: number|null; targetWeight: number|null; targetUnit: WeightUnit }`; `getWeekPlan(db): PlanDay[]` (always 7, Mon first); `getPlanDay(db, weekday): PlanDay`; `setPlanDayName(db, weekday, name: string): void`; `addPlanExercise(db, weekday, exerciseId): PlanExercise`; `getPlanExercise(db, id): PlannedExercise|undefined`; `updatePlanTargets(db, id, targets: PlanTargets): void`; `movePlanExercise(db, id, direction: -1|1): void`; `removePlanExercise(db, id): void`; `clearPlanDay(db, weekday): void`; `describePlanDay(day: PlanDay): string`.

- [ ] **Step 1: Edit the schema**

In `src/db/schema.ts`:

Add to `sessions` columns (after `notes`):
```ts
    /** The weekly-plan day this workout was started from; null for a blank workout. */
    planWeekday: integer('plan_weekday'),
```

Add to `sessionExercises` columns (after `notes`):
```ts
    // Targets copied from the weekly plan when the workout started, so later
    // plan edits don't rewrite history. All null for unplanned exercises.
    targetSets: integer('target_sets'),
    targetReps: integer('target_reps'),
    targetWeight: real('target_weight'),
    targetUnit: text('target_unit', { enum: WEIGHT_UNITS }),
```

Add after the `setEntries` table:
```ts
/** A day of the repeating weekly plan. Monday = 1 … Sunday = 7. A day with no exercises is a rest day. */
export const planDays = sqliteTable('plan_day', {
  weekday: integer('weekday').primaryKey(),
  name: text('name'),
});

/** A planned exercise on a weekly-plan day, with optional targets. */
export const planExercises = sqliteTable(
  'plan_exercise',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    weekday: integer('weekday')
      .notNull()
      .references(() => planDays.weekday, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    targetSets: integer('target_sets'),
    targetReps: integer('target_reps'),
    targetWeight: real('target_weight'),
    targetUnit: text('target_unit', { enum: WEIGHT_UNITS }).notNull(),
  },
  (t) => [index('plan_exercise_weekday_idx').on(t.weekday)],
);

/** One food log entry. `day` is a local `YYYY-MM-DD` date. */
export const foodEntries = sqliteTable(
  'food_entry',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    day: text('day').notNull(),
    loggedAt: integer('logged_at').notNull(),
    name: text('name').notNull(),
    calories: integer('calories').notNull(),
    protein: real('protein'),
    carbs: real('carbs'),
    fat: real('fat'),
  },
  (t) => [index('food_entry_day_idx').on(t.day)],
);

/** A reusable food. Logging one copies its values into a food entry. */
export const savedFoods = sqliteTable(
  'saved_food',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    calories: integer('calories').notNull(),
    protein: real('protein'),
    carbs: real('carbs'),
    fat: real('fat'),
  },
  (t) => [uniqueIndex('saved_food_name_unique').on(sql`lower(${t.name})`)],
);
```

Add after the existing relations:
```ts
export const planDaysRelations = relations(planDays, ({ many }) => ({
  exercises: many(planExercises),
}));

export const planExercisesRelations = relations(planExercises, ({ one }) => ({
  day: one(planDays, { fields: [planExercises.weekday], references: [planDays.weekday] }),
  exercise: one(exercises, { fields: [planExercises.exerciseId], references: [exercises.id] }),
}));
```

Add to the type exports:
```ts
export type PlanDayRow = typeof planDays.$inferSelect;
export type PlanExercise = typeof planExercises.$inferSelect;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type SavedFood = typeof savedFoods.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0002_<name>.sql` containing `CREATE TABLE \`plan_day\``, `CREATE TABLE \`plan_exercise\``, `CREATE TABLE \`food_entry\``, `CREATE TABLE \`saved_food\``, and `ALTER TABLE ... ADD \`plan_weekday\`` / `ADD \`target_sets\``… statements. `drizzle/migrations.js` now imports `m0002`. Inspect both files. `0000` and `0001` must be unchanged (`git diff --stat drizzle/0000_init.sql drizzle/0001_seed_exercises.sql` shows nothing).

Run: `npm test`
Expected: PASS — existing suites apply all three migrations in memory.

- [ ] **Step 3: Write the failing plan tests**

`src/data/plan.test.ts`:
```ts
import { eq } from 'drizzle-orm';

import { exercises } from '@/db/schema';
import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { createExercise, removeExercise } from './exercises';
import {
  addPlanExercise,
  clearPlanDay,
  describePlanDay,
  getPlanDay,
  getPlanExercise,
  getWeekPlan,
  movePlanExercise,
  removePlanExercise,
  setPlanDayName,
  updatePlanTargets,
} from './plan';
import { setDefaultUnit } from './settings';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

function exerciseId(name: string): number {
  return db.select().from(exercises).where(eq(exercises.name, name)).get()!.id;
}

const names = (weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7) =>
  getPlanDay(db, weekday).exercises.map((e) => e.exercise.name);

describe('weekly plan', () => {
  it('starts as seven empty rest days, Monday first', () => {
    const week = getWeekPlan(db);
    expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.every((d) => d.name === null && d.exercises.length === 0)).toBe(true);
    expect(describePlanDay(week[0])).toBe('Rest day');
  });

  it('names a day, trimming and clearing blanks', () => {
    setPlanDayName(db, 1, '  Push ');
    expect(getPlanDay(db, 1).name).toBe('Push');
    setPlanDayName(db, 1, '   ');
    expect(getPlanDay(db, 1).name).toBeNull();
  });

  it('adds exercises in order with no targets and the default unit', () => {
    setDefaultUnit(db, 'kg');
    addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 1, exerciseId('Barbell Row'));
    expect(names(1)).toEqual(['Bench Press', 'Barbell Row']);
    const first = getPlanDay(db, 1).exercises[0];
    expect(first).toMatchObject({
      targetSets: null,
      targetReps: null,
      targetWeight: null,
      targetUnit: 'kg',
    });
    expect(describePlanDay(getPlanDay(db, 1))).toBe('Workout · 2 exercises');
    setPlanDayName(db, 1, 'Push');
    expect(describePlanDay(getPlanDay(db, 1))).toBe('Push · 2 exercises');
  });

  it('returns the existing entry when an exercise is added twice', () => {
    const a = addPlanExercise(db, 2, exerciseId('Deadlift'));
    const b = addPlanExercise(db, 2, exerciseId('Deadlift'));
    expect(b.id).toBe(a.id);
    expect(names(2)).toEqual(['Deadlift']);
  });

  it('keeps days independent', () => {
    addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 3, exerciseId('Back Squat'));
    expect(names(1)).toEqual(['Bench Press']);
    expect(names(3)).toEqual(['Back Squat']);
    expect(getWeekPlan(db).map((d) => d.exercises.length)).toEqual([1, 0, 1, 0, 0, 0, 0]);
  });

  it('updates targets', () => {
    const pe = addPlanExercise(db, 1, exerciseId('Bench Press'));
    updatePlanTargets(db, pe.id, { targetSets: 3, targetReps: 8, targetWeight: 135, targetUnit: 'lb' });
    expect(getPlanExercise(db, pe.id)).toMatchObject({
      targetSets: 3,
      targetReps: 8,
      targetWeight: 135,
      targetUnit: 'lb',
      exercise: { name: 'Bench Press' },
    });
  });

  it('moves exercises up and down, ignoring moves past either end', () => {
    const a = addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 1, exerciseId('Barbell Row'));
    const c = addPlanExercise(db, 1, exerciseId('Deadlift'));
    movePlanExercise(db, c.id, -1);
    expect(names(1)).toEqual(['Bench Press', 'Deadlift', 'Barbell Row']);
    movePlanExercise(db, a.id, 1);
    expect(names(1)).toEqual(['Deadlift', 'Bench Press', 'Barbell Row']);
    movePlanExercise(db, getPlanDay(db, 1).exercises[0].id, -1);
    expect(names(1)).toEqual(['Deadlift', 'Bench Press', 'Barbell Row']);
  });

  it('removes one exercise or clears the whole day', () => {
    const a = addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 1, exerciseId('Barbell Row'));
    setPlanDayName(db, 1, 'Push');
    removePlanExercise(db, a.id);
    expect(names(1)).toEqual(['Barbell Row']);
    clearPlanDay(db, 1);
    expect(getPlanDay(db, 1)).toEqual({ weekday: 1, name: null, exercises: [] });
  });

  it('drops an exercise from the plan when an unused exercise is deleted', () => {
    const custom = createExercise(db, 'Cossack Squat');
    addPlanExercise(db, 4, custom.id);
    expect(removeExercise(db, custom.id)).toBe('deleted');
    expect(getPlanDay(db, 4).exercises).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest src/data/plan.test.ts`
Expected: FAIL — cannot find module `./plan`.

- [ ] **Step 5: Implement `src/data/plan.ts`**

```ts
import { and, asc, desc, eq, gt, lt, max } from 'drizzle-orm';

import {
  planDays,
  planExercises,
  type Exercise,
  type PlanExercise,
  type WeightUnit,
} from '@/db/schema';
import type { DB } from '@/db/types';
import { getDefaultUnit } from '@/data/settings';
import { WEEKDAYS, type Weekday } from '@/lib/days';

export type PlannedExercise = PlanExercise & { exercise: Exercise };

export type PlanDay = {
  weekday: Weekday;
  name: string | null;
  exercises: PlannedExercise[];
};

export type PlanTargets = {
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetUnit: WeightUnit;
};

function plannedExercises(db: DB, weekday?: Weekday): PlannedExercise[] {
  return db.query.planExercises
    .findMany({
      where: weekday === undefined ? undefined : eq(planExercises.weekday, weekday),
      orderBy: [asc(planExercises.weekday), asc(planExercises.position)],
      with: { exercise: true },
    })
    .sync();
}

/** All seven days, Monday first. Days never edited come back as unnamed rest days. */
export function getWeekPlan(db: DB): PlanDay[] {
  const names = new Map(db.select().from(planDays).all().map((d) => [d.weekday, d.name]));
  const all = plannedExercises(db);
  return WEEKDAYS.map((weekday) => ({
    weekday,
    name: names.get(weekday) ?? null,
    exercises: all.filter((e) => e.weekday === weekday),
  }));
}

export function getPlanDay(db: DB, weekday: Weekday): PlanDay {
  const row = db.select().from(planDays).where(eq(planDays.weekday, weekday)).get();
  return { weekday, name: row?.name ?? null, exercises: plannedExercises(db, weekday) };
}

/** "Rest day", or e.g. "Push · 5 exercises" ("Workout" when the day has no name). */
export function describePlanDay(day: PlanDay): string {
  const n = day.exercises.length;
  if (n === 0) return 'Rest day';
  return `${day.name ?? 'Workout'} · ${n} exercise${n === 1 ? '' : 's'}`;
}

export function setPlanDayName(db: DB, weekday: Weekday, name: string): void {
  const value = name.trim() === '' ? null : name.trim();
  db.insert(planDays)
    .values({ weekday, name: value })
    .onConflictDoUpdate({ target: planDays.weekday, set: { name: value } })
    .run();
}

/** Adds an exercise to the end of a day. Adding one that is already there returns the existing entry. */
export function addPlanExercise(db: DB, weekday: Weekday, exerciseId: number): PlanExercise {
  const existing = db
    .select()
    .from(planExercises)
    .where(and(eq(planExercises.weekday, weekday), eq(planExercises.exerciseId, exerciseId)))
    .get();
  if (existing) return existing;

  db.insert(planDays).values({ weekday }).onConflictDoNothing().run();
  const { last } = db
    .select({ last: max(planExercises.position) })
    .from(planExercises)
    .where(eq(planExercises.weekday, weekday))
    .get()!;
  return db
    .insert(planExercises)
    .values({ weekday, exerciseId, position: (last ?? -1) + 1, targetUnit: getDefaultUnit(db) })
    .returning()
    .get();
}

export function getPlanExercise(db: DB, id: number): PlannedExercise | undefined {
  return db.query.planExercises
    .findFirst({ where: eq(planExercises.id, id), with: { exercise: true } })
    .sync();
}

export function updatePlanTargets(db: DB, id: number, targets: PlanTargets): void {
  db.update(planExercises).set(targets).where(eq(planExercises.id, id)).run();
}

/** Swaps an exercise with its neighbour above (-1) or below (1). No-op at either end. */
export function movePlanExercise(db: DB, id: number, direction: -1 | 1): void {
  const item = db.select().from(planExercises).where(eq(planExercises.id, id)).get();
  if (!item) return;
  const neighbour = db
    .select()
    .from(planExercises)
    .where(
      and(
        eq(planExercises.weekday, item.weekday),
        direction < 0
          ? lt(planExercises.position, item.position)
          : gt(planExercises.position, item.position),
      ),
    )
    .orderBy(direction < 0 ? desc(planExercises.position) : asc(planExercises.position))
    .limit(1)
    .get();
  if (!neighbour) return;
  db.transaction((tx) => {
    tx.update(planExercises).set({ position: neighbour.position }).where(eq(planExercises.id, item.id)).run();
    tx.update(planExercises).set({ position: item.position }).where(eq(planExercises.id, neighbour.id)).run();
  });
}

export function removePlanExercise(db: DB, id: number): void {
  db.delete(planExercises).where(eq(planExercises.id, id)).run();
}

/** Removes a day's name and exercises, making it a rest day. */
export function clearPlanDay(db: DB, weekday: Weekday): void {
  db.delete(planDays).where(eq(planDays.weekday, weekday)).run();
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/data`
Expected: PASS.

- [ ] **Step 7: Check and commit**

```bash
npm run check
git add src/db/schema.ts drizzle src/data/plan.ts src/data/plan.test.ts
git commit -m "Add weekly plan and food tables with plan data layer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Planned workouts and set pre-fill

**Files:**
- Modify: `src/data/workouts.ts`
- Create: `src/data/planned-workout.test.ts`

**Interfaces:**
- Consumes: `getPlanDay` (Task 2); `getLastPerformance(db, exerciseId, excludeSessionId)` from `src/data/history.ts` (returns `{ sets: SetEntry[] } | undefined`, sets in logged order); `getDefaultUnit` from settings; `Weekday` (Task 1).
- Produces:
  - `startPlannedSession(db: DB, weekday: Weekday, now = Date.now()): Session`
  - `type SuggestedSet = { weight: number|null; unit: WeightUnit; reps: number|null }`
  - `suggestedSetValues(db: DB, sessionExerciseId: number): SuggestedSet | undefined`

- [ ] **Step 1: Write the failing tests**

`src/data/planned-workout.test.ts`:
```ts
import { eq } from 'drizzle-orm';

import { exercises } from '@/db/schema';
import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { addPlanExercise, setPlanDayName, updatePlanTargets } from './plan';
import { setDefaultUnit } from './settings';
import {
  addExerciseToSession,
  finishSession,
  getWorkout,
  logSet,
  startPlannedSession,
  startSession,
  suggestedSetValues,
} from './workouts';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

function exerciseId(name: string): number {
  return db.select().from(exercises).where(eq(exercises.name, name)).get()!.id;
}

const T0 = new Date(2026, 8, 28, 18, 0).getTime();

function planMonday() {
  setPlanDayName(db, 1, 'Push');
  const bench = addPlanExercise(db, 1, exerciseId('Bench Press'));
  updatePlanTargets(db, bench.id, { targetSets: 3, targetReps: 8, targetWeight: 135, targetUnit: 'lb' });
  addPlanExercise(db, 1, exerciseId('Dip'));
  return bench;
}

describe('startPlannedSession', () => {
  it("copies the day's exercises and targets in order", () => {
    planMonday();
    const session = startPlannedSession(db, 1, T0);
    expect(session.planWeekday).toBe(1);
    const workout = getWorkout(db, session.id)!;
    expect(workout.exercises.map((e) => e.exercise.name)).toEqual(['Bench Press', 'Dip']);
    expect(workout.exercises[0]).toMatchObject({
      targetSets: 3,
      targetReps: 8,
      targetWeight: 135,
      targetUnit: 'lb',
    });
    expect(workout.exercises[1]).toMatchObject({ targetSets: null, targetReps: null, targetWeight: null });
  });

  it('returns the workout already in progress unchanged', () => {
    planMonday();
    const blank = startSession(db, T0);
    const again = startPlannedSession(db, 1, T0 + 1000);
    expect(again.id).toBe(blank.id);
    expect(getWorkout(db, blank.id)!.exercises).toEqual([]);
  });

  it('keeps the snapshotted targets when the plan changes later', () => {
    const bench = planMonday();
    const session = startPlannedSession(db, 1, T0);
    updatePlanTargets(db, bench.id, { targetSets: 5, targetReps: 5, targetWeight: 155, targetUnit: 'lb' });
    expect(getWorkout(db, session.id)!.exercises[0]).toMatchObject({ targetSets: 3, targetWeight: 135 });
  });
});

describe('suggestedSetValues', () => {
  it('uses the targets before any set is logged', () => {
    planMonday();
    const session = startPlannedSession(db, 1, T0);
    const bench = getWorkout(db, session.id)!.exercises[0];
    expect(suggestedSetValues(db, bench.id)).toEqual({ weight: 135, unit: 'lb', reps: 8 });
  });

  it('follows the last set logged in this workout', () => {
    planMonday();
    const session = startPlannedSession(db, 1, T0);
    const bench = getWorkout(db, session.id)!.exercises[0];
    logSet(db, bench.id, { weight: 140, unit: 'lb', reps: 6 }, T0 + 60_000);
    expect(suggestedSetValues(db, bench.id)).toEqual({ weight: 140, unit: 'lb', reps: 6 });
  });

  it('fills fields without a target from the previous workout', () => {
    const earlier = startSession(db, T0 - 7 * 86_400_000);
    const se = addExerciseToSession(db, earlier.id, exerciseId('Bench Press'));
    logSet(db, se.id, { weight: 60, unit: 'kg', reps: 5 }, earlier.startedAt + 60_000);
    finishSession(db, earlier.id, earlier.startedAt + 3_600_000);

    const pe = addPlanExercise(db, 1, exerciseId('Bench Press'));
    updatePlanTargets(db, pe.id, { targetSets: 3, targetReps: 10, targetWeight: null, targetUnit: 'lb' });
    const session = startPlannedSession(db, 1, T0);
    const bench = getWorkout(db, session.id)!.exercises[0];
    expect(suggestedSetValues(db, bench.id)).toEqual({ weight: 60, unit: 'kg', reps: 10 });
  });

  it('falls back to empty fields in the default unit', () => {
    setDefaultUnit(db, 'kg');
    const session = startSession(db, T0);
    const se = addExerciseToSession(db, session.id, exerciseId('Deadlift'));
    expect(suggestedSetValues(db, se.id)).toEqual({ weight: null, unit: 'kg', reps: null });
  });

  it('returns undefined for an unknown exercise entry', () => {
    expect(suggestedSetValues(db, 9999)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/data/planned-workout.test.ts`
Expected: FAIL — `startPlannedSession` / `suggestedSetValues` are not exported.

- [ ] **Step 3: Implement in `src/data/workouts.ts`**

Add imports:
```ts
import { getLastPerformance } from '@/data/history';
import { getPlanDay } from '@/data/plan';
import { getDefaultUnit } from '@/data/settings';
import type { Weekday } from '@/lib/days';
```

Add below `startSession`:
```ts
/**
 * Starts a workout from a weekly-plan day: its exercises are added in order
 * with their targets copied in. Returns the workout already in progress, if any.
 */
export function startPlannedSession(db: DB, weekday: Weekday, now = Date.now()): Session {
  const active = getActiveSession(db);
  if (active) return active;
  const day = getPlanDay(db, weekday);
  return db.transaction((tx) => {
    const session = tx
      .insert(sessions)
      .values({ startedAt: now, planWeekday: weekday })
      .returning()
      .get();
    day.exercises.forEach((pe, position) => {
      tx.insert(sessionExercises)
        .values({
          sessionId: session.id,
          exerciseId: pe.exerciseId,
          position,
          targetSets: pe.targetSets,
          targetReps: pe.targetReps,
          targetWeight: pe.targetWeight,
          targetUnit: pe.targetUnit,
        })
        .run();
    });
    return session;
  });
}
```

Add at the end of the "Sets" section:
```ts
export type SuggestedSet = { weight: number | null; unit: WeightUnit; reps: number | null };

/**
 * What the set form starts with: the last set logged for this exercise in
 * this workout; otherwise the planned targets, with any field that has no
 * target taken from the previous workout's first set; otherwise empty.
 */
export function suggestedSetValues(db: DB, sessionExerciseId: number): SuggestedSet | undefined {
  const se = db.select().from(sessionExercises).where(eq(sessionExercises.id, sessionExerciseId)).get();
  if (!se) return undefined;

  const lastHere = db
    .select()
    .from(setEntries)
    .where(eq(setEntries.sessionExerciseId, sessionExerciseId))
    .orderBy(desc(setEntries.position))
    .limit(1)
    .get();
  if (lastHere) return { weight: lastHere.weight, unit: lastHere.unit, reps: lastHere.reps };

  const previous = getLastPerformance(db, se.exerciseId, se.sessionId)?.sets[0];
  const defaultUnit = getDefaultUnit(db);
  const weightTarget = se.targetWeight !== null;
  return {
    weight: weightTarget ? se.targetWeight : (previous?.weight ?? null),
    unit: weightTarget ? (se.targetUnit ?? defaultUnit) : (previous?.unit ?? defaultUnit),
    reps: se.targetReps ?? previous?.reps ?? null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/data`
Expected: PASS (new suite plus existing `data.test.ts`, `plan.test.ts`).

- [ ] **Step 5: Check and commit**

```bash
npm run check
git add src/data/workouts.ts src/data/planned-workout.test.ts
git commit -m "Start workouts from the weekly plan and pre-fill sets from targets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Food log data layer and nutrition targets

**Files:**
- Create: `src/data/food.ts`, `src/data/food.test.ts`
- Modify: `src/data/settings.ts`, `src/data/data.test.ts` (settings describe block)

**Interfaces:**
- Consumes: `foodEntries`, `savedFoods`, `FoodEntry`, `SavedFood` (Task 2); `MAX_CALORIES`, `NutritionTargets` (Task 1); `parseDayKey`, `DayKey` from dot-grid.
- Produces:
  - `type FoodInput = { name: string; calories: number; protein: number|null; carbs: number|null; fat: number|null }`; `class InvalidFoodError extends Error`
  - `listFoodEntries(db, day): FoodEntry[]`; `getFoodEntry(db, id): FoodEntry|undefined`; `type DayTotals = { calories: number } & Macros`; `dayTotals(db, day): DayTotals`; `addFoodEntry(db, day, input, opts?: { saveAsFood?: boolean }, now?): FoodEntry`; `updateFoodEntry(db, id, input): void`; `deleteFoodEntry(db, id): void`
  - `listSavedFoods(db, query?: string): SavedFood[]`; `getSavedFood(db, id)`; `saveFood(db, input): SavedFood`; `updateSavedFood(db, id, input): void`; `deleteSavedFood(db, id): void`
  - `getNutritionTargets(db): NutritionTargets`; `setNutritionTarget(db, which: keyof NutritionTargets, value: number|null): void`

- [ ] **Step 1: Write the failing tests**

`src/data/food.test.ts`:
```ts
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
```

Append inside the existing `describe('settings', …)` block of `src/data/data.test.ts` (and add `getNutritionTargets`, `setNutritionTarget` to its `./settings` import):
```ts
  it('stores optional nutrition targets', () => {
    expect(getNutritionTargets(db)).toEqual({ calories: null, protein: null, carbs: null, fat: null });
    setNutritionTarget(db, 'calories', 2200);
    setNutritionTarget(db, 'protein', 150);
    expect(getNutritionTargets(db)).toEqual({ calories: 2200, protein: 150, carbs: null, fat: null });
    setNutritionTarget(db, 'calories', null);
    expect(getNutritionTargets(db).calories).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/data`
Expected: FAIL — cannot find module `./food`; `getNutritionTargets` is not a function.

- [ ] **Step 3: Implement**

`src/data/food.ts`:
```ts
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
```

In `src/data/settings.ts`, add the import `import type { NutritionTargets } from '@/lib/nutrition';` and, above `setValue`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/data`
Expected: PASS.

- [ ] **Step 5: Check and commit**

```bash
npm run check
git add src/data/food.ts src/data/food.test.ts src/data/settings.ts src/data/data.test.ts
git commit -m "Add food log, saved foods and nutrition targets data layer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Backup version 2

**Files:**
- Modify: `src/data/backup.ts`, `src/data/backup.test.ts`

**Interfaces:**
- Consumes: new tables/types (Task 2); `addPlanExercise`, `setPlanDayName`, `updatePlanTargets` (Task 2); `startPlannedSession` (Task 3); `addFoodEntry` (Task 4); `isWeekday` (Task 1); `parseDayKey`.
- Produces: `BACKUP_VERSION = 2`; `Backup` gains `planDays: PlanDayRow[]`, `planExercises: PlanExercise[]`, `savedFoods: SavedFood[]`, `foodEntries: FoodEntry[]`. `parseBackup` accepts versions 1 and 2 and always returns a version-2 `Backup`.

- [ ] **Step 1: Write the failing tests**

In `src/data/backup.test.ts`, extend imports:
```ts
import { addFoodEntry } from './food';
import { addPlanExercise, setPlanDayName, updatePlanTargets } from './plan';
import { addExerciseToSession, finishSession, logSet, startPlannedSession, startSession } from './workouts';
```

Append to the end of `populate` (after `finishSession`):
```ts
  setPlanDayName(db, 1, 'Legs');
  const pe = addPlanExercise(db, 1, custom.id);
  updatePlanTargets(db, pe.id, { targetSets: 3, targetReps: 5, targetWeight: 100, targetUnit: 'kg' });
  const planned = startPlannedSession(db, 1, new Date(2026, 8, 7, 18, 0).getTime());
  const plannedExercise = getWorkout(db, planned.id)!.exercises[0];
  logSet(db, plannedExercise.id, { weight: 100, unit: 'kg', reps: 5 }, planned.startedAt + 60_000);
  finishSession(db, planned.id, planned.startedAt + 3_600_000);

  addFoodEntry(db, '2026-09-01', { name: 'Shake', calories: 300, protein: 40, carbs: null, fat: 5 }, { saveAsFood: true }, 1000);
  addFoodEntry(db, '2026-09-01', { name: 'Rice', calories: 200, protein: null, carbs: 45, fat: null }, {}, 2000);
```
(add `getWorkout` to the `./workouts` import).

Add tests inside `describe('backup', …)`:
```ts
  it('includes the weekly plan, food log and planned-workout targets', () => {
    const db = createTestDb();
    populate(db);
    const backup = exportBackup(db);
    expect(backup.version).toBe(2);
    expect(backup.planDays).toEqual([{ weekday: 1, name: 'Legs' }]);
    expect(backup.planExercises).toHaveLength(1);
    expect(backup.savedFoods.map((f) => f.name)).toEqual(['Shake']);
    expect(backup.foodEntries.map((f) => f.name)).toEqual(['Shake', 'Rice']);
    expect(backup.sessions.map((s) => s.planWeekday)).toEqual([null, 1]);
    expect(backup.sessionExercises[1]).toMatchObject({ targetSets: 3, targetReps: 5, targetWeight: 100 });
  });

  it('restores a version 1 backup made before the plan and food log', () => {
    const source = createTestDb();
    populate(source);
    const full = exportBackup(source);
    const omit = (row: object, keys: string[]) =>
      Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
    const v1 = {
      ...omit(full, ['planDays', 'planExercises', 'savedFoods', 'foodEntries']),
      version: 1,
      sessions: full.sessions.map((s) => omit(s, ['planWeekday'])),
      sessionExercises: full.sessionExercises.map((e) =>
        omit(e, ['targetSets', 'targetReps', 'targetWeight', 'targetUnit']),
      ),
    };

    const target = createTestDb();
    restoreBackup(target, parseBackup(JSON.stringify(v1)));
    const restored = exportBackup(target);
    expect(restored.sets).toEqual(full.sets);
    expect(restored.planDays).toEqual([]);
    expect(restored.planExercises).toEqual([]);
    expect(restored.savedFoods).toEqual([]);
    expect(restored.foodEntries).toEqual([]);
    expect(restored.sessions.every((s) => s.planWeekday === null)).toBe(true);
    expect(restored.sessionExercises.every((e) => e.targetSets === null && e.targetUnit === null)).toBe(true);
  });

  it('rejects malformed food entries', () => {
    const db = createTestDb();
    populate(db);
    const backup = exportBackup(db);
    (backup.foodEntries[0] as unknown as Record<string, unknown>).day = '2026-02-30';
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('foodEntries[0].day is invalid');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/data/backup.test.ts`
Expected: FAIL — `backup.version` is 1, `planDays` undefined, version 1 parse path missing.

- [ ] **Step 3: Implement in `src/data/backup.ts`**

Update imports:
```ts
import {
  exercises,
  foodEntries,
  planDays,
  planExercises,
  savedFoods,
  sessionExercises,
  sessions,
  setEntries,
  settings,
  WEIGHT_UNITS,
  type Exercise,
  type FoodEntry,
  type PlanDayRow,
  type PlanExercise,
  type SavedFood,
  type Session,
  type SessionExercise,
  type SetEntry,
} from '@/db/schema';
import type { DB } from '@/db/types';
import { isWeekday } from '@/lib/days';
import { parseDayKey } from '@/lib/dot-grid';
```

Replace the version constant and `Backup` type:
```ts
export const BACKUP_VERSION = 2;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  settings: { key: string; value: string }[];
  exercises: Exercise[];
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: SetEntry[];
  planDays: PlanDayRow[];
  planExercises: PlanExercise[];
  savedFoods: SavedFood[];
  foodEntries: FoodEntry[];
};
```

Add to the object returned by `exportBackup`:
```ts
    planDays: db.select().from(planDays).orderBy(asc(planDays.weekday)).all(),
    planExercises: db.select().from(planExercises).orderBy(asc(planExercises.id)).all(),
    savedFoods: db.select().from(savedFoods).orderBy(asc(savedFoods.id)).all(),
    foodEntries: db.select().from(foodEntries).orderBy(asc(foodEntries.id)).all(),
```

Add next to the other checks:
```ts
const isUnit: Check = (v) => WEIGHT_UNITS.includes(v as never);
```
and use `unit: isUnit` in the existing `sets` check.

Add above `parseBackup`:
```ts
/** Version 1 predates the weekly plan and food log: add empty tables and null columns. */
function upgradeV1(b: Record<string, unknown>): void {
  if (Array.isArray(b.sessions)) {
    b.sessions = b.sessions.map((s: object) => ({ planWeekday: null, ...s }));
  }
  if (Array.isArray(b.sessionExercises)) {
    b.sessionExercises = b.sessionExercises.map((e: object) => ({
      targetSets: null,
      targetReps: null,
      targetWeight: null,
      targetUnit: null,
      ...e,
    }));
  }
  b.planDays = [];
  b.planExercises = [];
  b.savedFoods = [];
  b.foodEntries = [];
  b.version = BACKUP_VERSION;
}
```

In `parseBackup`, replace the version check with:
```ts
  if (b.version === 1) upgradeV1(b);
  if (b.version !== BACKUP_VERSION) {
    throw new InvalidBackupError(`Unsupported backup version ${String(b.version)}`);
  }
```

Extend the `sessions` and `sessionExercises` shapes:
```ts
  checkRows(b.sessions, 'sessions', {
    id: isInt,
    startedAt: isInt,
    endedAt: nullable(isInt),
    notes: nullable(isStr),
    planWeekday: nullable((v) => isInt(v) && isWeekday(v as number)),
  });
  checkRows(b.sessionExercises, 'sessionExercises', {
    id: isInt,
    sessionId: isInt,
    exerciseId: isInt,
    position: isInt,
    notes: nullable(isStr),
    targetSets: nullable(isInt),
    targetReps: nullable(isInt),
    targetWeight: nullable(isNum),
    targetUnit: nullable(isUnit),
  });
```

Add after the `sets` check, before `return`:
```ts
  checkRows(b.planDays, 'planDays', {
    weekday: (v) => isInt(v) && isWeekday(v as number),
    name: nullable(isStr),
  });
  checkRows(b.planExercises, 'planExercises', {
    id: isInt,
    weekday: isInt,
    exerciseId: isInt,
    position: isInt,
    targetSets: nullable(isInt),
    targetReps: nullable(isInt),
    targetWeight: nullable(isNum),
    targetUnit: isUnit,
  });
  checkRows(b.savedFoods, 'savedFoods', {
    id: isInt,
    name: isStr,
    calories: isInt,
    protein: nullable(isNum),
    carbs: nullable(isNum),
    fat: nullable(isNum),
  });
  checkRows(b.foodEntries, 'foodEntries', {
    id: isInt,
    day: (v) => isStr(v) && parseDayKey(v as string) !== null,
    loggedAt: isInt,
    name: isStr,
    calories: isInt,
    protein: nullable(isNum),
    carbs: nullable(isNum),
    fat: nullable(isNum),
  });
```

Replace the body of `restoreBackup`'s transaction:
```ts
  db.transaction((tx) => {
    tx.delete(foodEntries).run();
    tx.delete(savedFoods).run();
    tx.delete(planExercises).run();
    tx.delete(planDays).run();
    tx.delete(setEntries).run();
    tx.delete(sessionExercises).run();
    tx.delete(sessions).run();
    tx.delete(exercises).run();
    tx.delete(settings).run();

    for (const c of chunks(backup.settings)) tx.insert(settings).values(c).run();
    for (const c of chunks(backup.exercises)) tx.insert(exercises).values(c).run();
    for (const c of chunks(backup.sessions)) tx.insert(sessions).values(c).run();
    for (const c of chunks(backup.sessionExercises)) tx.insert(sessionExercises).values(c).run();
    for (const c of chunks(backup.sets)) tx.insert(setEntries).values(c).run();
    for (const c of chunks(backup.planDays)) tx.insert(planDays).values(c).run();
    for (const c of chunks(backup.planExercises)) tx.insert(planExercises).values(c).run();
    for (const c of chunks(backup.savedFoods)) tx.insert(savedFoods).values(c).run();
    for (const c of chunks(backup.foodEntries)) tx.insert(foodEntries).values(c).run();
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/data`
Expected: PASS, including the existing round-trip, malformed-row, version-99 and failed-restore tests.

- [ ] **Step 5: Check and commit**

```bash
npm run check
git add src/data/backup.ts src/data/backup.test.ts
git commit -m "Back up the weekly plan and food log (backup version 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Plan tab, day editor, targets modal; move Exercises under Settings

**Files:**
- Modify: `src/app/(tabs)/_layout.tsx`, `src/app/_layout.tsx`, `src/app/add-exercise.tsx`, `src/app/(tabs)/settings.tsx`
- Move: `src/app/(tabs)/exercises.tsx` → `src/app/exercises.tsx` (`git mv`)
- Create: `src/app/(tabs)/plan.tsx`, `src/app/plan/[weekday].tsx`, `src/app/plan-exercise/[id].tsx`

**Interfaces:**
- Consumes: everything in `src/data/plan.ts` (Task 2); `WEEKDAY_NAMES`, `isWeekday`, `weekdayOf`, `Weekday` (Task 1); `formatTargets` (Task 1); `parseOptionalCount`, `parseWeight` from units; UI kit from `src/components/ui.tsx` (`Screen`, `Card`, `Button`, `TextField`, `Segmented`, `SectionTitle`, `EmptyState`, `ListRow`).
- Produces: routes `/plan` (tab), `/plan/[weekday]`, `/plan-exercise/[id]`, `/exercises`; `add-exercise` accepts either `sessionId` or `weekday` param.

UI tasks have no unit tests; the gate is `npm run check` plus checking the screens in the simulator.

- [ ] **Step 1: Tabs and stack screens**

`src/app/(tabs)/_layout.tsx` — replace the `exercises` trigger with a `plan` trigger placed right after `index`:
```tsx
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
```
Order is now: index, plan, history, settings.

Move the exercises screen:
```bash
git mv "src/app/(tabs)/exercises.tsx" src/app/exercises.tsx
```
and replace its contents with (it now has a header, so no `safeTop` and no title text):
```tsx
import { router } from 'expo-router';

import { ExerciseList } from '@/components/exercise-list';
import { Screen } from '@/components/ui';

export default function ExercisesScreen() {
  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <ExerciseList onSelect={(e) => router.push(`/exercise/${e.id}`)} />
    </Screen>
  );
}
```

`src/app/_layout.tsx` — add inside `<Stack>` after `set/[id]`:
```tsx
        <Stack.Screen name="exercises" options={{ title: 'Exercises' }} />
        <Stack.Screen name="plan/[weekday]" options={{ title: 'Plan' }} />
        <Stack.Screen
          name="plan-exercise/[id]"
          options={{ title: 'Targets', presentation: 'modal' }}
        />
```

`src/app/(tabs)/settings.tsx` — add `router` from `expo-router` and `ListRow` from `@/components/ui` to the imports, and insert above `<SectionTitle>Backup</SectionTitle>`:
```tsx
      <SectionTitle>Library</SectionTitle>
      <View>
        <ListRow title="Exercises" right="›" onPress={() => router.push('/exercises')} />
      </View>
```

- [ ] **Step 2: Plan tab**

`src/app/(tabs)/plan.tsx`:
```tsx
import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ListRow, Screen } from '@/components/ui';
import { describePlanDay, getWeekPlan } from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { WEEKDAY_NAMES, weekdayOf } from '@/lib/days';

export default function PlanTab() {
  const week = useDbQuery(getWeekPlan);
  const today = weekdayOf(new Date());

  return (
    <Screen safeTop>
      <ThemedText type="subtitle">Weekly plan</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Repeats every week. Tap a day to plan its exercises and targets.
      </ThemedText>
      <View>
        {week.map((day) => (
          <ListRow
            key={day.weekday}
            title={`${WEEKDAY_NAMES[day.weekday]}${day.weekday === today ? ' · Today' : ''}`}
            subtitle={describePlanDay(day)}
            right="›"
            onPress={() => router.push(`/plan/${day.weekday}`)}
          />
        ))}
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: Day editor**

`src/app/plan/[weekday].tsx`:
```tsx
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import {
  clearPlanDay,
  getPlanDay,
  movePlanExercise,
  setPlanDayName,
  type PlannedExercise,
} from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { isWeekday, WEEKDAY_NAMES, type Weekday } from '@/lib/days';
import { formatTargets } from '@/lib/targets';

export default function PlanDayScreen() {
  const weekday = Number(useLocalSearchParams<{ weekday: string }>().weekday);
  if (!isWeekday(weekday)) {
    return (
      <Screen>
        <EmptyState title="Day not found" />
      </Screen>
    );
  }
  return <PlanDayEditor weekday={weekday} />;
}

function PlanDayEditor({ weekday }: { weekday: Weekday }) {
  const day = useDbQuery((d) => getPlanDay(d, weekday));
  const [name, setName] = useState(day.name ?? '');

  const rename = (text: string) => {
    setName(text);
    setPlanDayName(db, weekday, text);
  };

  const confirmClear = () =>
    Alert.alert(`Clear ${WEEKDAY_NAMES[weekday]}?`, 'Removes its name and all planned exercises.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearPlanDay(db, weekday);
          setName('');
        },
      },
    ]);

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: WEEKDAY_NAMES[weekday] }} />

      <SectionTitle>Name</SectionTitle>
      <TextField
        value={name}
        onChangeText={rename}
        placeholder="e.g. Push"
        returnKeyType="done"
        accessibilityLabel="Day name"
      />

      <SectionTitle>Exercises</SectionTitle>
      {day.exercises.length === 0 ? (
        <EmptyState title="Rest day" message="Add exercises to plan a workout for this day." />
      ) : (
        <View>
          {day.exercises.map((pe, i) => (
            <PlanExerciseRow
              key={pe.id}
              item={pe}
              isFirst={i === 0}
              isLast={i === day.exercises.length - 1}
            />
          ))}
        </View>
      )}

      <Button
        title="+ Add exercise"
        size="large"
        onPress={() => router.push({ pathname: '/add-exercise', params: { weekday } })}
      />
      {day.exercises.length > 0 || day.name !== null ? (
        <Button title="Clear day" variant="danger" onPress={confirmClear} />
      ) : null}
    </Screen>
  );
}

function PlanExerciseRow({
  item,
  isFirst,
  isLast,
}: {
  item: PlannedExercise;
  isFirst: boolean;
  isLast: boolean;
}) {
  const theme = useTheme();
  const target = formatTargets(item) ?? 'No target';
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable
        style={({ pressed }) => [styles.flex, { opacity: pressed ? 0.6 : 1 }]}
        onPress={() => router.push(`/plan-exercise/${item.id}`)}>
        <ThemedText numberOfLines={1}>{item.exercise.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.exercise.archived ? `${target} · archived` : target}
        </ThemedText>
      </Pressable>
      <Button
        title="↑"
        size="small"
        disabled={isFirst}
        accessibilityLabel={`Move ${item.exercise.name} up`}
        onPress={() => movePlanExercise(db, item.id, -1)}
      />
      <Button
        title="↓"
        size="small"
        disabled={isLast}
        accessibilityLabel={`Move ${item.exercise.name} down`}
        onPress={() => movePlanExercise(db, item.id, 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
```

- [ ] **Step 4: Targets modal**

`src/app/plan-exercise/[id].tsx`:
```tsx
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { WEIGHT_UNITS, type WeightUnit } from '@/db/schema';
import {
  getPlanExercise,
  removePlanExercise,
  updatePlanTargets,
  type PlannedExercise,
} from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { parseOptionalCount, parseWeight } from '@/lib/units';

const UNIT_OPTIONS = WEIGHT_UNITS.map((u) => ({ value: u, label: u }));
const text = (v: number | null) => (v === null ? '' : String(v));

export default function PlanExerciseModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const item = useDbQuery((d) => getPlanExercise(d, id));
  if (!item) {
    return (
      <Screen>
        <EmptyState title="Not in the plan" />
      </Screen>
    );
  }
  return <TargetsForm key={item.id} item={item} />;
}

function TargetsForm({ item }: { item: PlannedExercise }) {
  const [sets, setSets] = useState(text(item.targetSets));
  const [reps, setReps] = useState(text(item.targetReps));
  const [weight, setWeight] = useState(text(item.targetWeight));
  const [unit, setUnit] = useState<WeightUnit>(item.targetUnit);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const s = parseOptionalCount(sets, 'Sets');
    if (!s.ok) return setError(s.error);
    const r = parseOptionalCount(reps, 'Reps');
    if (!r.ok) return setError(r.error);
    const w = parseWeight(weight);
    if (!w.ok) return setError(w.error);
    updatePlanTargets(db, item.id, {
      targetSets: s.value,
      targetReps: r.value,
      targetWeight: w.value,
      targetUnit: unit,
    });
    router.back();
  };

  const remove = () => {
    router.back();
    removePlanExercise(db, item.id);
  };

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: item.exercise.name }} />
      <View style={styles.row}>
        <TextField
          value={sets}
          onChangeText={setSets}
          placeholder="Sets"
          keyboardType="number-pad"
          accessibilityLabel="Target sets"
          style={styles.flex}
        />
        <ThemedText themeColor="textSecondary">×</ThemedText>
        <TextField
          value={reps}
          onChangeText={setReps}
          placeholder="Reps"
          keyboardType="number-pad"
          accessibilityLabel="Target reps"
          style={styles.flex}
        />
      </View>
      <View style={styles.row}>
        <TextField
          value={weight}
          onChangeText={setWeight}
          placeholder="Weight"
          keyboardType="decimal-pad"
          accessibilityLabel="Target weight"
          style={styles.flex}
        />
        <Segmented options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        All optional. Targets pre-fill the set form when you start this day&apos;s workout.
      </ThemedText>
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <Button title="Save" variant="primary" size="large" onPress={save} />
      <Button title="Remove from day" variant="danger" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
```

- [ ] **Step 5: Add-exercise plan mode**

Replace `src/app/add-exercise.tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';

import { ExerciseList } from '@/components/exercise-list';
import { Screen } from '@/components/ui';
import { db } from '@/db/client';
import { addPlanExercise, getPlanDay } from '@/data/plan';
import { addExerciseToSession, getWorkout } from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';
import { isWeekday } from '@/lib/days';

/** Picks an exercise for a workout (`sessionId`) or a weekly-plan day (`weekday`). */
export default function AddExerciseModal() {
  const params = useLocalSearchParams<{ sessionId?: string; weekday?: string }>();
  const weekdayParam = Number(params.weekday);
  const weekday = isWeekday(weekdayParam) ? weekdayParam : null;
  const sessionId = Number(params.sessionId);

  const added = useDbQuery(
    (d) =>
      new Set(
        weekday !== null
          ? getPlanDay(d, weekday).exercises.map((e) => e.exerciseId)
          : getWorkout(d, sessionId)?.exercises.map((e) => e.exerciseId),
      ),
  );

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <ExerciseList
        rightText={(e) => (added.has(e.id) ? 'Added' : undefined)}
        onSelect={(exercise) => {
          if (weekday !== null) addPlanExercise(db, weekday, exercise.id);
          else addExerciseToSession(db, sessionId, exercise.id);
          router.back();
        }}
      />
    </Screen>
  );
}
```

- [ ] **Step 6: Check**

Run: `npm run check`
Expected: PASS. If typecheck rejects `/plan/...`, `/plan-exercise/...` or `/exercises`, regenerate typed routes (see Global Constraints) and re-run.

- [ ] **Step 7: Verify in the simulator**

Build and launch the dev build (`npm run ios`, or the `run` skill / iOS Simulator tool). Check:
1. Tabs read Workout · Plan · History · Settings.
2. Plan → Monday → name "Push" → Add exercise → Bench Press, then Dip. Rows show "No target".
3. Tap Bench Press → 3 × 8, 135 lb → Save. Row shows "3 × 8 @ 135 lb".
4. ↓ on Bench Press reorders. Back on the Plan tab, Monday reads "Push · 2 exercises".
5. Clear day → confirm → "Rest day".
6. Settings → Library → Exercises opens the list; tapping one opens exercise detail.
Take a screenshot of the day editor for the record.

- [ ] **Step 8: Commit**

```bash
git add -A src/app
git commit -m "Add Plan tab with day editor and targets; move Exercises under Settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Start planned workouts from the Workout tab; targets on exercise cards

**Files:**
- Create: `src/components/today-plan-card.tsx`
- Modify: `src/app/(tabs)/index.tsx`, `src/components/exercise-card.tsx`

**Interfaces:**
- Consumes: `getWeekPlan`, `describePlanDay` (Task 2); `startPlannedSession`, `suggestedSetValues`, `startSession` (Task 3); `formatTargets`, `WEEKDAY_NAMES`, `weekdayOf`, `Weekday` (Task 1).
- Produces: `TodayPlanCard({ onStartPlanned: (weekday: Weekday) => void; onStartBlank: () => void })`.

- [ ] **Step 1: Today card**

`src/components/today-plan-card.tsx`:
```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow } from '@/components/ui';
import { describePlanDay, getWeekPlan } from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { WEEKDAY_NAMES, weekdayOf, type Weekday } from '@/lib/days';

/** Today's planned workout, with a blank workout and other plan days as alternatives. */
export function TodayPlanCard({
  onStartPlanned,
  onStartBlank,
}: {
  onStartPlanned: (weekday: Weekday) => void;
  onStartBlank: () => void;
}) {
  const week = useDbQuery(getWeekPlan);
  const todayWeekday = weekdayOf(new Date());
  const today = week[todayWeekday - 1];
  const planned = today.exercises.length > 0;
  const otherDays = week.filter((d) => d.exercises.length > 0 && d.weekday !== todayWeekday);
  const [picking, setPicking] = useState(false);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.flex}>
          <ThemedText style={styles.title}>{WEEKDAY_NAMES[todayWeekday]}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describePlanDay(today)}
          </ThemedText>
        </View>
        <Button title="Edit plan" variant="plain" size="small" onPress={() => router.navigate('/plan')} />
      </View>

      {planned ? (
        <Button
          title={`Start ${today.name ?? 'planned workout'}`}
          variant="primary"
          size="large"
          onPress={() => onStartPlanned(todayWeekday)}
        />
      ) : null}
      <Button
        title="Start blank workout"
        variant={planned ? 'secondary' : 'primary'}
        size={planned ? 'normal' : 'large'}
        onPress={onStartBlank}
      />

      {otherDays.length > 0 ? (
        <Button
          title={picking ? 'Hide other days' : 'Use another day…'}
          variant="plain"
          onPress={() => setPicking(!picking)}
        />
      ) : null}
      {picking
        ? otherDays.map((d) => (
            <ListRow
              key={d.weekday}
              title={WEEKDAY_NAMES[d.weekday]}
              subtitle={describePlanDay(d)}
              right="Start"
              onPress={() => onStartPlanned(d.weekday)}
            />
          ))
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: 600 },
});
```

- [ ] **Step 2: Wire into the Workout tab**

In `src/app/(tabs)/index.tsx`:
- Imports: add `import { TodayPlanCard } from '@/components/today-plan-card';`, change the workouts import to `import { listWorkoutSummaries, startPlannedSession, startSession } from '@/data/workouts';`, add `import type { Weekday } from '@/lib/days';`.
- Replace the `start` function with:
```tsx
  const startBlank = () => {
    const session = startSession(db);
    router.push(`/workout/${session.id}`);
  };

  const startPlanned = (weekday: Weekday) => {
    const session = startPlannedSession(db, weekday);
    router.push(`/workout/${session.id}`);
  };
```
- Replace the `: (<Button title="Start workout" … />)` branch with:
```tsx
      ) : (
        <TodayPlanCard onStartPlanned={startPlanned} onStartBlank={startBlank} />
      )}
```

- [ ] **Step 3: Targets and pre-fill on the exercise card**

In `src/components/exercise-card.tsx`:
- Change the workouts import to `import { logSet, removeSessionExercise, suggestedSetValues, type WorkoutExercise } from '@/data/workouts';` and add `import { formatTargets } from '@/lib/targets';`.
- Replace the `template` / `initial` block with:
```tsx
  // Last set here, else the planned targets, else last time (see suggestedSetValues).
  const suggested = useDbQuery((d) => suggestedSetValues(d, item.id));
  const initial: SetFormValues = suggested ?? { weight: null, unit: defaultUnit, reps: null };
  const target = formatTargets(item);
```
- Insert directly above the `{last ? (` "Last time" block:
```tsx
      {target ? (
        <ThemedText type="small" style={styles.target}>
          Target {target}
          {item.targetSets !== null ? `  ·  ${item.sets.length}/${item.targetSets} sets` : ''}
        </ThemedText>
      ) : null}
```
- Change the `SetForm` key to:
```tsx
        key={`${item.id}:${item.sets.length}:${initial.weight}:${initial.unit}:${initial.reps}`}
```
- Add `target: { fontWeight: 600 },` to `styles`.

- [ ] **Step 4: Check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Verify in the simulator**

With Thursday (today's weekday, or whichever day the simulator clock says) planned as "Push" with Bench Press 3 × 8 @ 135 lb and Dip with no target:
1. Workout tab shows "<Day> · Push · 2 exercises", **Start Push**, **Start blank workout**, **Edit plan** (switches to the Plan tab).
2. Start Push → both exercises present. Bench card shows "Target 3 × 8 @ 135 lb · 0/3 sets", and the form shows 135 / lb / 8.
3. Change the weight to 140 and log. Progress reads 1/3 and the form now shows 140 × 8. Tap the logged set and edit its reps in the set modal; the change saves.
4. Finish. Plan a different day and check "Use another day…" lists it and starts it.
5. On a rest day the card says "Rest day" and the blank workout is the primary button.
Screenshot the planned workout screen.

- [ ] **Step 6: Commit**

```bash
git add src/components/today-plan-card.tsx "src/app/(tabs)/index.tsx" src/components/exercise-card.tsx
git commit -m "Start planned workouts from the Workout tab and show targets while logging

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Food tab, food modals, saved foods and nutrition targets UI

**Files:**
- Create: `src/app/(tabs)/food.tsx`, `src/components/food-form.tsx`, `src/app/food/new.tsx`, `src/app/food/[id].tsx`, `src/app/foods.tsx`, `src/app/saved-food/[id].tsx`, `src/components/target-field.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`, `src/app/_layout.tsx`, `src/app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: everything in `src/data/food.ts`, `getNutritionTargets`, `setNutritionTarget` (Task 4); `parseCalories`, `parseMacro`, `formatKcal`, `macroSummary`, `macroLines`, `calorieStatus`, `MAX_CALORIES` (Task 1); `formatDayKey`, `shiftDayKey` (Task 1); `dayKey`, `parseDayKey` from dot-grid; `parseOptionalCount` from units.
- Produces: routes `/food` (tab), `/food/new?day=`, `/food/[id]`, `/foods`, `/saved-food/[id]`; `FoodForm`, `TargetField` components.

- [ ] **Step 1: Tab and stack registration**

`src/app/(tabs)/_layout.tsx` — add after the `plan` trigger:
```tsx
      <NativeTabs.Trigger name="food">
        <NativeTabs.Trigger.Label>Food</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
      </NativeTabs.Trigger>
```
Order: index, plan, food, history, settings.

`src/app/_layout.tsx` — add inside `<Stack>`:
```tsx
        <Stack.Screen name="food/new" options={{ title: 'Add Food', presentation: 'modal' }} />
        <Stack.Screen name="food/[id]" options={{ title: 'Edit Food', presentation: 'modal' }} />
        <Stack.Screen name="foods" options={{ title: 'Saved Foods' }} />
        <Stack.Screen
          name="saved-food/[id]"
          options={{ title: 'Edit Saved Food', presentation: 'modal' }}
        />
```

- [ ] **Step 2: Shared food form**

`src/components/food-form.tsx`:
```tsx
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { FoodInput } from '@/data/food';
import { parseCalories, parseMacro } from '@/lib/nutrition';

const text = (v: number | null | undefined) => (v == null ? '' : String(v));

/** Name, calories (required) and optional protein/carbs/fat. */
export function FoodForm({
  initial,
  submitLabel,
  onSubmit,
  showSaveToggle = false,
}: {
  initial?: Partial<FoodInput>;
  submitLabel: string;
  onSubmit: (input: FoodInput, saveAsFood: boolean) => void;
  showSaveToggle?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [calories, setCalories] = useState(text(initial?.calories));
  const [protein, setProtein] = useState(text(initial?.protein));
  const [carbs, setCarbs] = useState(text(initial?.carbs));
  const [fat, setFat] = useState(text(initial?.fat));
  const [saveAsFood, setSaveAsFood] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (name.trim() === '') return setError('Name is required');
    const c = parseCalories(calories);
    if (!c.ok) return setError(c.error);
    const p = parseMacro(protein, 'Protein');
    if (!p.ok) return setError(p.error);
    const cb = parseMacro(carbs, 'Carbs');
    if (!cb.ok) return setError(cb.error);
    const f = parseMacro(fat, 'Fat');
    if (!f.ok) return setError(f.error);
    setError(null);
    onSubmit(
      { name: name.trim(), calories: c.value, protein: p.value, carbs: cb.value, fat: f.value },
      saveAsFood,
    );
  };

  return (
    <View style={styles.container}>
      <TextField
        value={name}
        onChangeText={setName}
        placeholder="Name (e.g. Lunch)"
        accessibilityLabel="Food name"
        returnKeyType="next"
      />
      <View style={styles.row}>
        <TextField
          value={calories}
          onChangeText={setCalories}
          placeholder="Calories"
          keyboardType="number-pad"
          accessibilityLabel="Calories"
          style={styles.flex}
        />
        <ThemedText themeColor="textSecondary">kcal</ThemedText>
      </View>
      <View style={styles.row}>
        <TextField
          value={protein}
          onChangeText={setProtein}
          placeholder="Protein g"
          keyboardType="decimal-pad"
          accessibilityLabel="Protein grams"
          style={styles.flex}
        />
        <TextField
          value={carbs}
          onChangeText={setCarbs}
          placeholder="Carbs g"
          keyboardType="decimal-pad"
          accessibilityLabel="Carbs grams"
          style={styles.flex}
        />
        <TextField
          value={fat}
          onChangeText={setFat}
          placeholder="Fat g"
          keyboardType="decimal-pad"
          accessibilityLabel="Fat grams"
          style={styles.flex}
        />
      </View>
      {showSaveToggle ? (
        <View style={styles.row}>
          <ThemedText style={styles.flex}>Save as food</ThemedText>
          <Switch value={saveAsFood} onValueChange={setSaveAsFood} accessibilityLabel="Save as food" />
        </View>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <Button title={submitLabel} variant="primary" size="large" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
```

- [ ] **Step 3: Food tab**

`src/app/(tabs)/food.tsx`:
```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { dayTotals, listFoodEntries } from '@/data/food';
import { getNutritionTargets } from '@/data/settings';
import { useDbQuery } from '@/hooks/use-db-query';
import { formatDayKey, shiftDayKey } from '@/lib/days';
import { dayKey } from '@/lib/dot-grid';
import { calorieStatus, formatKcal, macroLines, macroSummary } from '@/lib/nutrition';

export default function FoodTab() {
  const [day, setDay] = useState(() => dayKey(new Date()));
  const entries = useDbQuery((d) => listFoodEntries(d, day));
  const totals = useDbQuery((d) => dayTotals(d, day));
  const targets = useDbQuery(getNutritionTargets);
  const isToday = day === dayKey(new Date());
  const status = calorieStatus(totals.calories, targets.calories);

  return (
    <Screen safeTop>
      <View style={styles.dayRow}>
        <Button title="‹" size="small" accessibilityLabel="Previous day" onPress={() => setDay(shiftDayKey(day, -1))} />
        <ThemedText type="subtitle" style={styles.dayLabel}>
          {formatDayKey(day)}
        </ThemedText>
        <Button title="›" size="small" accessibilityLabel="Next day" onPress={() => setDay(shiftDayKey(day, 1))} />
      </View>
      {!isToday ? (
        <Button title="Back to today" variant="plain" onPress={() => setDay(dayKey(new Date()))} />
      ) : null}

      <Card>
        <ThemedText style={styles.total}>
          {formatKcal(totals.calories)}
          {targets.calories !== null ? ` / ${formatKcal(targets.calories)}` : ''} kcal
        </ThemedText>
        {status ? (
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
        ) : null}
        {macroLines(totals, targets).map((line) => (
          <ThemedText key={line} type="small">
            {line}
          </ThemedText>
        ))}
      </Card>

      <Button
        title="+ Add food"
        variant="primary"
        size="large"
        onPress={() => router.push({ pathname: '/food/new', params: { day } })}
      />

      {entries.length === 0 ? (
        <EmptyState title="Nothing logged" message="Food you log for this day shows up here." />
      ) : (
        <View>
          {entries.map((e) => (
            <ListRow
              key={e.id}
              title={e.name}
              subtitle={macroSummary(e)}
              right={`${formatKcal(e.calories)} kcal`}
              onPress={() => router.push(`/food/${e.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayLabel: { flex: 1, textAlign: 'center' },
  total: { fontSize: 28, fontWeight: 700, lineHeight: 34 },
});
```

- [ ] **Step 4: Add / edit entry modals**

`src/app/food/new.tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { FoodForm } from '@/components/food-form';
import { EmptyState, ListRow, Screen, SectionTitle, TextField } from '@/components/ui';
import { db } from '@/db/client';
import type { SavedFood } from '@/db/schema';
import { addFoodEntry, listSavedFoods } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';
import { dayKey, parseDayKey } from '@/lib/dot-grid';
import { formatKcal, macroSummary } from '@/lib/nutrition';

export default function AddFoodModal() {
  const param = useLocalSearchParams<{ day?: string }>().day;
  const day = param && parseDayKey(param) ? param : dayKey(new Date());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<SavedFood | null>(null);
  const saved = useDbQuery((d) => listSavedFoods(d, query));

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <FoodForm
        // Re-mount to fill the fields when a saved food is picked.
        key={picked?.id ?? 'new'}
        initial={picked ?? undefined}
        submitLabel="Add"
        showSaveToggle
        onSubmit={(input, saveAsFood) => {
          try {
            addFoodEntry(db, day, input, { saveAsFood });
            router.back();
          } catch (e) {
            Alert.alert('Could not add food', (e as Error).message);
          }
        }}
      />

      <SectionTitle>Saved foods</SectionTitle>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search saved foods"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {saved.length === 0 ? (
        <EmptyState
          title={query.trim() === '' ? 'No saved foods yet' : 'No matches'}
          message='Turn on "Save as food" to reuse an entry with one tap.'
        />
      ) : (
        <View>
          {saved.map((f) => (
            <ListRow
              key={f.id}
              title={f.name}
              subtitle={macroSummary(f)}
              right={`${formatKcal(f.calories)} kcal`}
              onPress={() => setPicked(f)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
```

`src/app/food/[id].tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { FoodForm } from '@/components/food-form';
import { Button, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { deleteFoodEntry, getFoodEntry, updateFoodEntry } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';

export default function EditFoodModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const entry = useDbQuery((d) => getFoodEntry(d, id));

  if (!entry) {
    return (
      <Screen>
        <EmptyState title="Entry not found" />
      </Screen>
    );
  }

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <FoodForm
        initial={entry}
        submitLabel="Save"
        onSubmit={(input) => {
          try {
            updateFoodEntry(db, id, input);
            router.back();
          } catch (e) {
            Alert.alert('Could not save', (e as Error).message);
          }
        }}
      />
      <Button
        title="Delete entry"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete this entry?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                router.back();
                deleteFoodEntry(db, id);
              },
            },
          ])
        }
      />
    </Screen>
  );
}
```

- [ ] **Step 5: Saved foods list and editor**

`src/app/foods.tsx`:
```tsx
import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, ListRow, Screen } from '@/components/ui';
import { listSavedFoods } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';
import { formatKcal, macroSummary } from '@/lib/nutrition';

export default function SavedFoodsScreen() {
  const foods = useDbQuery((d) => listSavedFoods(d));
  return (
    <Screen>
      {foods.length === 0 ? (
        <EmptyState
          title="No saved foods"
          message='When adding food, turn on "Save as food" to keep it here.'
        />
      ) : (
        <View>
          {foods.map((f) => (
            <ListRow
              key={f.id}
              title={f.name}
              subtitle={macroSummary(f)}
              right={`${formatKcal(f.calories)} kcal`}
              onPress={() => router.push(`/saved-food/${f.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
```

`src/app/saved-food/[id].tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { FoodForm } from '@/components/food-form';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { deleteSavedFood, getSavedFood, updateSavedFood } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';

export default function EditSavedFoodModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const food = useDbQuery((d) => getSavedFood(d, id));

  if (!food) {
    return (
      <Screen>
        <EmptyState title="Saved food not found" />
      </Screen>
    );
  }

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <FoodForm
        initial={food}
        submitLabel="Save"
        onSubmit={(input) => {
          try {
            updateSavedFood(db, id, input);
            router.back();
          } catch (e) {
            Alert.alert('Could not save', (e as Error).message);
          }
        }}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Changes apply to future entries only; food already logged keeps its values.
      </ThemedText>
      <Button
        title="Delete saved food"
        variant="danger"
        onPress={() => {
          router.back();
          deleteSavedFood(db, id);
        }}
      />
    </Screen>
  );
}
```

- [ ] **Step 6: Nutrition targets in Settings**

`src/components/target-field.tsx`:
```tsx
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { parseOptionalCount } from '@/lib/units';

/** An optional positive whole-number target, saved when editing ends. */
export function TargetField({
  label,
  unit,
  value,
  max,
  onSave,
}: {
  label: string;
  unit: string;
  value: number | null;
  max: number;
  onSave: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));

  const commit = () => {
    const result = parseOptionalCount(text, label, max);
    if (!result.ok) {
      Alert.alert('Invalid target', result.error);
      setText(value === null ? '' : String(value));
      return;
    }
    onSave(result.value);
  };

  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextField
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        placeholder="None"
        keyboardType="number-pad"
        accessibilityLabel={`${label} target`}
        style={styles.input}
      />
      <ThemedText themeColor="textSecondary" style={styles.unit}>
        {unit}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flex: 1 },
  input: { width: 100, textAlign: 'right' },
  unit: { width: 36 },
});
```

In `src/app/(tabs)/settings.tsx`:
- Imports: add `import { TargetField } from '@/components/target-field';`, add `getNutritionTargets, setNutritionTarget` to the `@/data/settings` import, add `import { MAX_CALORIES } from '@/lib/nutrition';`.
- In the component body: `const targets = useDbQuery(getNutritionTargets);`
- Insert above `<SectionTitle>Library</SectionTitle>`:
```tsx
      <SectionTitle>Daily nutrition targets</SectionTitle>
      <Card>
        <TargetField
          label="Calories"
          unit="kcal"
          max={MAX_CALORIES}
          value={targets.calories}
          onSave={(v) => setNutritionTarget(db, 'calories', v)}
        />
        <TargetField
          label="Protein"
          unit="g"
          max={2000}
          value={targets.protein}
          onSave={(v) => setNutritionTarget(db, 'protein', v)}
        />
        <TargetField
          label="Carbs"
          unit="g"
          max={2000}
          value={targets.carbs}
          onSave={(v) => setNutritionTarget(db, 'carbs', v)}
        />
        <TargetField
          label="Fat"
          unit="g"
          max={2000}
          value={targets.fat}
          onSave={(v) => setNutritionTarget(db, 'fat', v)}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Leave blank for no target. Macros without a target only show once you log them.
        </ThemedText>
      </Card>
```
- In the Library `<View>`, add below the Exercises row:
```tsx
        <ListRow title="Saved foods" right="›" onPress={() => router.push('/foods')} />
```
- Update the restore confirmation message to mention food:
```tsx
        `This backup has ${backup.sessions.length} workouts, ${backup.sets.length} sets and ` +
          `${backup.foodEntries.length} food entries. Everything currently on this phone will be replaced.`,
```

- [ ] **Step 7: Check**

Run: `npm run check`
Expected: PASS (regenerate typed routes if new routes are rejected).

- [ ] **Step 8: Verify in the simulator**

1. Tabs read Workout · Plan · Food · History · Settings, with no "More" tab.
2. Settings: set Calories 2200 and Protein 150. Entering "abc" shows an alert and reverts.
3. Food → Add food: "Shake", 300, protein 40, Save as food on → Add. The summary reads "300 / 2,200 kcal", "1,900 kcal left", "Protein 40 / 150 g".
4. Add food again → tap "Shake" under Saved foods → the fields fill → Add. The total is 600.
5. Tap an entry and change calories to 350 → Save; then delete it. Totals update each time.
6. ‹ goes to "Yesterday", which is empty. "Back to today" returns.
7. Settings → Saved foods → edit Shake to 320; today's entries keep their values.
8. Settings → Export backup (JSON) succeeds. The share sheet opening is enough.
Screenshot the Food tab with entries.

- [ ] **Step 9: Commit**

```bash
git add -A src/app src/components
git commit -m "Add Food tab with daily log, saved foods and nutrition targets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Update project docs and final verification

**Files:**
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Update `docs/PLAN.md`**

- In **Decisions**, add rows:
  - `| Weekly plan | Repeating Mon–Sun plan; targets snapshotted into each workout | Plan edits never rewrite history |`
  - `| Calorie tracking | Manual entries; calories required, macros optional; saved foods copy into entries | Offline, no food database |`
  - `| Tabs | Workout · Plan · Food · History · Settings (Exercises under Settings) | iOS shows five tabs before "More" |`
- In **Data model**, add `plan_weekday NULL` to `session`, and `target_sets/target_reps/target_weight/target_unit NULL` to `session_exercise`. Add:
```
plan_day          (weekday PK 1–7 Mon=1, name NULL)          no exercises = rest day
plan_exercise     (id, weekday → plan_day CASCADE, exercise_id → exercise CASCADE,
                   position, target_sets NULL, target_reps NULL, target_weight NULL,
                   target_unit 'lb'|'kg')
food_entry        (id, day 'YYYY-MM-DD' local, logged_at, name, calories,
                   protein NULL, carbs NULL, fat NULL)
saved_food        (id, name UNIQUE nocase, calories, protein/carbs/fat NULL)
```
  Add rules: "Starting a planned workout copies the day's exercises and targets; the set form pre-fills from the last set in this workout, then targets, then last time." and "Logging a saved food copies its values." and "Backups are version 2; version 1 files still restore."
- In **Code layout**, replace the `(tabs)/` line with `Workout · Plan · Food · History · Settings`, and add `plan/[weekday]`, `plan-exercise/[id]`, `food/new`, `food/[id]`, `foods`, `saved-food/[id]`, `exercises`.
- In **Milestones**, add `| M6 | Weekly plan with targets; planned workouts | Done |` and `| M7 | Calorie and macro tracking | Done |`.
- In **Later**, change "workout templates / routines" to "multi-week programs".

- [ ] **Step 2: Full check**

Run: `npm run check`
Expected: PASS — typecheck clean, lint clean, all Jest suites green. Paste the test summary line into the task notes.

- [ ] **Step 3: Migration safety check on an existing install**

In the simulator app that already has v1 data (from before Task 2), relaunch the latest build. It must start without the "Database error" screen, with existing workouts still listed in History.

- [ ] **Step 4: Commit**

```bash
git add docs/PLAN.md
git commit -m "Document weekly plan and calorie tracking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
