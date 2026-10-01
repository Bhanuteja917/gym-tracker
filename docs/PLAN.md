# Plan

## Goal

A personal gym log for one person on one iPhone. Log the exercises and sets
done in each session and see past performance. Android later from the same code.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Framework | Expo (React Native) + TypeScript | One codebase for iOS now and Android later; first-class SQLite |
| Storage | `expo-sqlite` + Drizzle ORM | On-device only; typed queries; versioned migrations keep data safe across updates |
| Install path | Free Apple ID sideload from a Mac (`expo run:ios --device --configuration Release`) | No distribution needed; re-sign every 7 days |
| Weight units | Each set stores the value **as entered** plus its unit (`lb`/`kg`); default `lb` | No rounding drift; convert only for display and comparisons |
| Rest time | Derived from consecutive `completed_at` timestamps | Nothing to type |
| RPE | Optional, behind "More" on each set | Keeps set rows clean |
| Cardio (time/distance) | Not in v1 | Scope |
| Starter exercises | ~37 common lifts seeded by migration | Fast first use |
| Theme | Follows system light/dark | |
| Weekly plan | Repeating Mon–Sun plan; targets snapshotted into each workout | Plan edits never rewrite history |
| Calorie tracking | Manual entries; calories required, macros optional; saved foods copy into entries | Offline, no food database |
| Tabs | Workout · Plan · Food · History · Settings (Exercises under Settings) | iOS shows five tabs before "More" |

## Data model

```
settings          (key PK, value)                       default_unit = 'lb'
exercise          (id, name UNIQUE nocase, category, archived, created_at)
session           (id, started_at, ended_at NULL, notes, plan_weekday NULL)  ended_at NULL = in progress
session_exercise  (id, session_id → session CASCADE, exercise_id → exercise RESTRICT,
                   position, notes, target_sets NULL, target_reps NULL,
                   target_weight NULL, target_unit 'lb'|'kg')
set_entry         (id, session_exercise_id → session_exercise CASCADE, position,
                   weight REAL NULL, unit 'lb'|'kg', reps, rpe NULL, notes NULL,
                   completed_at)
plan_day          (weekday PK 1–7 Mon=1, name NULL)    no exercises = rest day
plan_exercise     (id, weekday → plan_day CASCADE, exercise_id → exercise CASCADE,
                   position, target_sets NULL, target_reps NULL, target_weight NULL,
                   target_unit 'lb'|'kg')
food_entry        (id, day 'YYYY-MM-DD' local, logged_at, name, calories,
                   protein NULL, carbs NULL, fat NULL)
saved_food        (id, name UNIQUE nocase, calories, protein/carbs/fat NULL)
```

Timestamps are epoch milliseconds. A null weight is a bodyweight set.

Rules enforced in `src/data/`:

- At most one workout in progress. Resuming a finished workout is refused while
  another is in progress.
- Finishing a workout with no sets discards it.
- An exercise with history can't be deleted, only archived (hidden from lists).
- Restoring a backup replaces everything in one transaction; on any error
  nothing changes.
- Starting a planned workout copies the day's exercises and targets; the set form
  pre-fills from the last set in this workout, then targets, then last time.
- Logging a saved food copies its values.
- Backups are version 2; version 1 files still restore.

## Code layout

```
drizzle/            generated SQL migrations (+ custom seed migration)
src/db/             schema, client (expo-sqlite), DB type
src/data/           all queries and business rules — plain functions taking a DB
src/lib/            pure helpers: unit conversion/parsing, time formatting
src/hooks/          useDbQuery (re-runs on DB change), useNow
src/components/     UI building blocks, set form, exercise card
src/app/            screens (Expo Router)
  (tabs)/           Workout · Plan · Food · History · Settings
  workout/[id]      log / view / edit a workout
  plan/[weekday]    view and edit a day's plan
  plan-exercise/[id]  edit a planned exercise's targets
  food/new          log a new food entry
  food/[id]         view/edit logged food entry
  foods             saved foods list
  saved-food/[id]   view/edit a saved food
  exercise/[id]     exercise history, best set, rename, archive
  add-exercise      modal picker (search or create)
  exercises         exercises list (moved under Settings)
  set/[id]          modal to edit or delete a set
```

Data functions are synchronous and take the DB as a parameter, so the same code
runs against expo-sqlite in the app and an in-memory better-sqlite3 database in
Jest tests (`src/test/test-db.ts`, which applies the real migrations).

## Milestones

| # | Deliverable | Status |
|---|---|---|
| M0 | Expo project, Drizzle + migrations, lint/typecheck/test | Done |
| M1 | Schema, seed exercises, data layer, unit conversion + tests | Done |
| M2 | Start workout → add exercise → log sets → finish | Done |
| M3 | History, workout detail, edit/delete sets, exercise history | Done |
| M4 | Settings (default unit), JSON/CSV export, JSON restore | Done |
| M5 | Install on iPhone via free Apple ID | See README |
| M6 | Weekly plan with targets; planned workouts | Done |
| M7 | Calorie and macro tracking | Done |

## Later

- Rest timer with notification
- Charts of progress per exercise (e.g. estimated 1RM over time)
- Reorder exercises within a workout; multi-week programs
- Cardio and timed exercises
- Android build (`npm run android`) — the app avoids iOS-only APIs apart from
  SF Symbol tab icons, which already have Material fallbacks
