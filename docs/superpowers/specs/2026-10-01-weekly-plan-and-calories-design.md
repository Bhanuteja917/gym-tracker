# Weekly Plan and Calorie Tracking — Design

Date: 2026-10-01

Two independent features added to the single-user, offline gym tracker:

1. **Weekly plan** — a repeating Mon–Sun plan (no calendar dates). Each day has
   an optional name and an ordered list of exercises with optional targets
   (sets × reps @ weight). Workouts can be started from a day's plan.
2. **Calorie tracking** — manual daily food log with required calories and
   optional protein/carbs/fat, daily targets, and saved foods for quick re-logging.

## Data model

All new tables are added via `src/db/schema.ts` + `npm run db:generate`
(migration `0002`). Existing migrations are not edited.

### Weekly plan

```
plan_day       (weekday INTEGER PK 1–7 [Mon=1 … Sun=7], name TEXT NULL)
plan_exercise  (id PK, weekday → plan_day CASCADE, exercise_id → exercise CASCADE,
                position INTEGER, target_sets INTEGER NULL, target_reps INTEGER NULL,
                target_weight REAL NULL, target_unit 'lb'|'kg' NOT NULL)
```

- A day with no `plan_exercise` rows is a **Rest** day. `plan_day` rows are
  created lazily (upsert) when a name is set or an exercise is added.
- All targets are optional. `target_unit` defaults to the `default_unit` setting
  at creation time.
- Deleting an exercise (allowed only when it has no history) removes it from the
  plan via cascade. Archived exercises remain in the plan, flagged "archived".

### Workout ↔ plan link

- `session.plan_weekday INTEGER NULL` — the plan day a workout started from;
  null for blank workouts.
- `session_exercise` gains `target_sets`, `target_reps`, `target_weight`
  (all NULL) and `target_unit` (NULL). Targets are **snapshotted** when the
  workout starts, so later plan edits never change history.

### Calories

```
food_entry  (id PK, day TEXT 'YYYY-MM-DD' local date, logged_at INTEGER (epoch ms),
             name TEXT NOT NULL, calories INTEGER NOT NULL,
             protein REAL NULL, carbs REAL NULL, fat REAL NULL)
saved_food  (id PK, name TEXT UNIQUE (case-insensitive), calories INTEGER NOT NULL,
             protein REAL NULL, carbs REAL NULL, fat REAL NULL)
```

- `day` is a local calendar date string so entries stay on the day chosen,
  regardless of time zone changes; index on `day`.
- Logging from a saved food **copies** its values into `food_entry`; editing or
  deleting a saved food never alters past entries.
- Targets live in `settings`: `calorie_target`, `protein_target`,
  `carbs_target`, `fat_target` (all optional, positive integers).

### Backup

- JSON backup bumps to `version: 2` and includes `planDays`, `planExercises`,
  `foodEntries`, `savedFoods`, plus the new session / session_exercise columns.
- Version 1 files still restore: new tables empty, new columns null.
- Restore remains all-or-nothing in one transaction.
- CSV export remains workouts only.

## Screens and navigation

Tabs become **Workout · Plan · Food · History · Settings**. The Exercises tab
moves into Settings as an "Exercises" row pushing the existing list screen
(exercise detail/rename/archive unchanged).

### Plan tab — `src/app/(tabs)/plan.tsx`

- List of Mon–Sun rows: day name or "Rest", and "N exercises". Today highlighted.
- Tap → `src/app/plan/[weekday].tsx`:
  - Day name text field (placeholder "e.g. Push").
  - Ordered exercise list showing targets ("3 × 8 @ 135 lb", or partial forms
    like "3 sets", "8 reps", "— no target —"); up/down reorder; remove.
  - "Add exercise" reuses `add-exercise` modal (parameterised for plan mode).
  - Tap an exercise → `src/app/plan-exercise/[id].tsx` modal: sets, reps,
    weight, unit (all optional); Remove.
  - "Clear day" (confirm) → deletes exercises and name; day becomes Rest.

### Workout tab — no workout in progress

- Today card: "Monday · Push · 5 exercises" + primary **Start Push**
  (or "Start planned workout" when the day has no name).
- **Use another day…** → picker of days that have exercises.
- Secondary **Start blank workout**.
- **Edit plan** link → Plan tab.
- Rest day / empty plan: card reads "Rest day"; blank workout is primary.
- Attendance grid unchanged.

### Planned workout in progress

- Plan exercises added in order with targets snapshotted.
- Exercise card shows "Target 3 × 8 @ 135 lb" and progress "2/3" when
  `target_sets` is set.
- Set form pre-fill order (all fields remain editable before saving; sets stay
  editable afterwards as today):
  1. Last set logged for this exercise in **this** workout (weight, unit, reps).
  2. Otherwise target weight/unit/reps (each field falls back independently
     to step 3 if its target is null).
  3. Otherwise existing default behaviour.
- Adding/removing exercises works as today; added exercises have no target.
- Finishing unchanged (no sets → discarded).

### Food tab — `src/app/(tabs)/food.tsx`

- Day header with ‹ › arrows, defaults to today; "Today" shortcut when on
  another day.
- Summary: "1,450 / 2,200 kcal" (or "1,450 kcal" with no target). Macro line
  for each of protein/carbs/fat shown only if its target is set or any entry
  that day has a value for it.
- Entries list for the day (name, kcal, macros); tap → edit/delete modal.
- **Add food** → `src/app/food/new.tsx` modal (also used for edit via
  `src/app/food/[id].tsx`): search over saved foods (tap fills form); fields
  name, calories (required), protein/carbs/fat (optional); "Save as food" toggle
  (upserts saved food by name). The entry's day is the day being viewed.

### Settings additions

- **Nutrition targets** — calories, protein, carbs, fat (blank = unset).
- **Foods** — saved food list; tap to edit; delete.
- **Exercises** — the former Exercises tab screen.

## Data layer

Synchronous functions taking `DB`, in line with existing code.

- `src/data/plan.ts`: `getWeekPlan`, `getPlanDay`, `setPlanDayName`,
  `addPlanExercise`, `updatePlanTargets`, `movePlanExercise`,
  `removePlanExercise`, `clearPlanDay`, `planDaysWithExercises`.
- `src/data/workouts.ts`:
  - `startPlannedSession(db, weekday, now)` — in one transaction creates the
    session with `plan_weekday` and copies plan exercises + targets. If a workout
    is already in progress, returns it unchanged (same as `startSession`).
  - `suggestedSetValues(db, sessionExerciseId)` — implements the pre-fill order.
- `src/data/food.ts`: `listFoodEntries(day)`, `dayTotals(day)`, `addFoodEntry`
  (optional `saveAsFood`), `updateFoodEntry`, `deleteFoodEntry`,
  `listSavedFoods(query?)`, `updateSavedFood`, `deleteSavedFood`.
- `src/data/settings.ts`: `getNutritionTargets`, `setNutritionTargets`.
- `src/lib/days.ts`: `localDay(date)`, `shiftDay(day, n)`, `weekdayOf(date)`
  (Mon=1), `WEEKDAY_NAMES`.

### Validation

- Calories: integer 0–20,000. Macros: number ≥ 0 or null.
- Food / saved food names: trimmed, non-empty.
- Nutrition targets: positive integers or unset.
- Plan targets: `target_sets`, `target_reps` positive integers or null;
  `target_weight` ≥ 0 or null.
- Day name: trimmed; empty → null.

## Testing

Jest against in-memory SQLite with real migrations (`src/test/test-db.ts`):

- Plan CRUD, reorder, clear day, cascade when an unused exercise is deleted.
- `startPlannedSession`: copies order and targets; returns the running workout
  if one exists; snapshots survive later plan edits.
- `suggestedSetValues`: all three pre-fill branches, including partial targets.
- Food: per-day totals with null macros, entries isolated by day, saved-food
  upsert by name (case-insensitive), entries are copies.
- Backup v2 round-trip of new tables/columns; v1 import still succeeds.
- `days.ts`: midnight and week boundaries, month/year rollover in `shiftDay`.

`npm run check` must pass; screens verified in the iOS simulator.

## Out of scope

Online food database / barcode scanning, calories burned / net calories,
dated plan overrides, multi-week programs, food CSV export.
