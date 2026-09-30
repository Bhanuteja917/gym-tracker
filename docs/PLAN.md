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

## Data model

```
settings          (key PK, value)                       default_unit = 'lb'
exercise          (id, name UNIQUE nocase, category, archived, created_at)
session           (id, started_at, ended_at NULL, notes)  ended_at NULL = in progress
session_exercise  (id, session_id → session CASCADE, exercise_id → exercise RESTRICT,
                   position, notes)
set_entry         (id, session_exercise_id → session_exercise CASCADE, position,
                   weight REAL NULL, unit 'lb'|'kg', reps, rpe NULL, notes NULL,
                   completed_at)
```

Timestamps are epoch milliseconds. A null weight is a bodyweight set.

Rules enforced in `src/data/`:

- At most one workout in progress. Resuming a finished workout is refused while
  another is in progress.
- Finishing a workout with no sets discards it.
- An exercise with history can't be deleted, only archived (hidden from lists).
- Restoring a backup replaces everything in one transaction; on any error
  nothing changes.

## Code layout

```
drizzle/            generated SQL migrations (+ custom seed migration)
src/db/             schema, client (expo-sqlite), DB type
src/data/           all queries and business rules — plain functions taking a DB
src/lib/            pure helpers: unit conversion/parsing, time formatting
src/hooks/          useDbQuery (re-runs on DB change), useNow
src/components/     UI building blocks, set form, exercise card
src/app/            screens (Expo Router)
  (tabs)/           Workout · History · Exercises · Settings
  workout/[id]      log / view / edit a workout
  exercise/[id]     exercise history, best set, rename, archive
  add-exercise      modal picker (search or create)
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

## Later

- Rest timer with notification
- Charts of progress per exercise (e.g. estimated 1RM over time)
- Reorder exercises within a workout; workout templates / routines
- Cardio and timed exercises
- Android build (`npm run android`) — the app avoids iOS-only APIs apart from
  SF Symbol tab icons, which already have Material fallbacks
