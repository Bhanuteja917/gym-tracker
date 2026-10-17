# SetStack (Gym Tracker)

A personal workout log you install on your iPhone from Safari. Plan your week,
log sets at the gym, even with no signal, and watch your progress. Data syncs
to a Neon Postgres database, so it's backed up and available on any device.

The app is a Next.js PWA in [`web/`](web/). Setup, local development, deployment
and installing on your phone are in [`web/README.md`](web/README.md).

- **Stack:** Next.js 16 · React 19 · Tailwind 4 + shadcn/ui · Prisma 7 on Neon ·
  Better Auth (email + password, passkeys) · Dexie (offline data) · Vitest
- **Hosting:** Vercel, with **Root Directory** set to `web`

## Features

- Log workouts: exercises, sets of weight × reps (lb or kg), optional RPE and
  notes. The next set is pre-filled, and each exercise shows what you did last time.
- **Works offline:** everything is saved on the phone first and syncs when the
  connection returns.
- **Weekly plan:** pick what to train each day, Monday to Sunday, with targets of
  sets × reps. Start today's plan from the Workout tab. Use a built-in template
  (a 5-day gym plan, or the same week with no equipment) or save your own.
- History, per-exercise best set and estimated 1RM chart, a body chart of the
  muscles you trained, and attendance dots.
- An exercise library of about 840 exercises, with muscle groups and video links.
- Sign in with a passkey (Face ID / Touch ID) or email and password.

## Docs

- [`docs/PWA-PLAN.md`](docs/PWA-PLAN.md): scope, data model and decisions
- [`docs/OFFLINE-PLAN.md`](docs/OFFLINE-PLAN.md): how offline storage and sync work

## Quick start

```sh
cd web
npm install
npm run check   # typecheck, lint, unit tests
npm run dev
```

See [`web/README.md`](web/README.md) for the environment variables and database setup.
