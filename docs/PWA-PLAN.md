# Gym Tracker PWA — Plan

A web version of Gym Tracker that installs on iPhone from Safari
("Add to Home Screen"), signs in with Google or Apple, and stores data in Neon
Postgres. It lives in `web/`, next to the existing Expo app, which is unchanged.

## 1. Scope

**In v1**

- Sign in with Google or Apple; sign out. All app routes require a session.
- Exercises: create, rename, tag with a muscle group, optional video link,
  archive. Exercises with history can't be deleted, only archived.
- Workouts: start, add exercises, log sets (weight + unit or bodyweight, reps,
  optional RPE and notes), edit/delete sets, finish, delete. At most one
  workout in progress. Finishing a workout with no sets discards it.
- "Last time" for each exercise while logging; next set pre-filled from the
  previous one.
- History list; workout detail.
- Per-exercise progress: best set, estimated 1RM per workout (chart), history.
- Settings: default unit (lb/kg), import a JSON backup from the Expo app,
  sign out.
- Installable PWA with an offline fallback for pages already visited.

**Later:** weekly plan with targets, calorie tracking, rest timer, CSV export.

**Assumptions**

- One real user for now, but every row of workout data is owned by a user and
  every query is scoped to the signed-in user.
- Weights are stored as entered with their unit; convert only for display
  (same rule as the Expo app).
- Sign-up is open to anyone who can sign in with Google/Apple. For a personal
  deployment you can restrict it with `ALLOWED_EMAILS` (see §4).

## 2. Architecture

| Layer | Where | Notes |
|---|---|---|
| Routes / UI | `web/src/app/` | App Router. `(app)/` = signed-in pages, `sign-in/` public |
| UI building blocks | `web/src/components/` | shadcn/ui in `components/ui/` |
| Server Actions | `web/src/actions/` | Thin: get the user, validate input with zod, call the domain layer, `refresh()` |
| Domain + DB access | `web/src/server/` | Plain async functions taking `userId` first; every query filters by it |
| Auth | `web/src/server/auth.ts`, `web/src/server/session.ts` | Better Auth config; `requireUser()` |
| Pure helpers + validation | `web/src/lib/` | Units, 1RM, formatting, zod schemas; unit-tested |
| DB schema | `web/prisma/schema.prisma` | Prisma 7, `prisma-client` generator to `src/generated/prisma` |

Stack versions: Next.js 16.4, React 19.3, Tailwind 4, shadcn/ui, Prisma 7.10
(`@prisma/adapter-pg`), Better Auth 1.7.9, zod 4, Vitest. Prisma 8 is still a
release candidate, so 7.10 (latest stable) is used. The standard `pg` adapter
works with Neon's pooled endpoint and with a plain local Postgres, so tests
run against a real database.

Rendering: Next 16 Cache Components are on. Pages render a static shell
(title, nav) and stream user data inside `<Suspense>`; the session is read only
inside those boundaries. Mutations are Server Actions that re-check the session.

`proxy.ts` only does an optimistic cookie check to redirect signed-out users to
`/sign-in`; the real check is `requireUser()` in every page and action.

## 3. Data model

Better Auth tables (`user`, `session`, `account`, `verification`) are generated
by the Better Auth CLI. App tables:

```
user.default_unit     'lb' | 'kg'  (column added to Better Auth's user table)
exercise              (id, user_id → user CASCADE, name, muscle_group NULL,
                       video_url NULL, archived, created_at, updated_at)
                      UNIQUE (user_id, name); INDEX (user_id, archived)
workout               (id, user_id → user CASCADE, started_at, ended_at NULL,
                       notes NULL, created_at, updated_at)
                      INDEX (user_id, started_at)  ended_at NULL = in progress
workout_exercise      (id, workout_id → workout CASCADE,
                       exercise_id → exercise RESTRICT, position, notes NULL)
                      INDEX (workout_id), INDEX (exercise_id)
exercise_set          (id, workout_exercise_id → workout_exercise CASCADE,
                       position, weight DOUBLE NULL, unit 'lb'|'kg', reps,
                       rpe NULL, notes NULL, completed_at)
                      INDEX (workout_exercise_id)
```

- A null weight is a bodyweight set. Rest time is derivable from `completed_at`.
- `workout_exercise` and `exercise_set` don't carry `user_id`; they're reached
  only through a workout the user owns, and the domain layer always checks that
  ownership. A workout can only reference the same user's exercises.
- Exercise names are unique per user, case-insensitively (checked in the
  domain layer; the DB constraint is the case-sensitive backstop).
- Muscle group is free text with suggestions (defaults + names in use), which
  maps 1:1 to the Expo app's `category`.

## 4. Auth (Better Auth)

- `betterAuth({ database: prismaAdapter(prisma, { provider: 'postgresql' }),
  socialProviders: { google, apple }, plugins: [nextCookies()] })`.
- Route handler: `app/api/auth/[...all]/route.ts` → `toNextJsHandler(auth)`.
- Client: `createAuthClient()` from `better-auth/react`; sign-in page calls
  `signIn.social({ provider })`, sign out calls `signOut()`.
- Apple: client secret JWT signed at startup with `jose` from the `.p8` key
  (Team ID, Key ID, Service ID). `https://appleid.apple.com` in
  `trustedOrigins`. **Apple doesn't allow localhost**, so Apple sign-in only
  works on an HTTPS deployment (or a tunnel); Google works on localhost.
- Each provider is enabled only when its env vars are set, so the app runs with
  just Google configured.
- Optional `ALLOWED_EMAILS` (comma-separated): a `databaseHooks.user.create`
  hook refuses sign-up for anyone else. Recommended for a personal deployment.
- Secrets only in env vars, never `NEXT_PUBLIC_*`.

## 5. PWA

- `app/manifest.ts`: name, `display: 'standalone'`, `start_url: '/'`, theme and
  background colors, 192/512 icons + maskable icon.
- `apple-icon.png` (180×180), `appleWebApp` metadata (capable, status bar style,
  title), `viewport-fit=cover` and safe-area padding so content clears the
  notch and home indicator.
- Service worker `public/sw.js` (no library): cache-first for `/_next/static`
  and icons; network-first for page navigations, falling back to the cached copy
  of that page, then to an offline page. Signed-in HTML is cached only for
  pages already visited, and all caches are cleared on sign out.
- Served with `Cache-Control: no-cache` and a strict CSP per the Next.js PWA guide.
- `experimental.useOffline` so a soft navigation without network waits and
  retries instead of erroring; an "Offline" badge from `useOffline()`.
- Install hint on Settings for iOS Safari when not running standalone.

## 6. Core features: screens

Bottom tab bar: **Workout · History · Exercises · Settings**.

- `/` Workout: continue the workout in progress or start one; recent workouts.
- `/workouts/[id]`: exercise cards with sets, last time, add-set form, add
  exercise (search or create), finish/delete.
- `/history`: finished workouts, newest first, with sets/volume summary.
- `/exercises`, `/exercises/[id]`: list with muscle-group filter; detail with
  best set, e1RM chart (inline SVG, no chart library), history, edit/archive.
- `/settings`: default unit, import backup, install instructions, sign out.

## 7. Testing, security, validation

- Vitest unit tests for `lib/` (units, parsing, 1RM, backup parsing).
- Vitest integration tests for `server/` against a real Postgres
  (`TEST_DATABASE_URL`), including **cross-user isolation**: user B can't read
  or change user A's workouts, sets or exercises.
- `npm run check` = typecheck + lint + tests; `npm run build` before deploy.
- All action input validated with zod on the server; IDs never trusted:
  every lookup is `where: { id, userId }` (or through the owning workout).
- Better Auth defaults: CSRF/origin checks on, secure cookies in production,
  rate limiting on.

## 8. Deployment

- Neon project → pooled connection string as `DATABASE_URL`, direct string as
  `DATABASE_URL_UNPOOLED` (used by `prisma migrate deploy`; same names the
  Neon–Vercel integration sets).
- Vercel project with **Root Directory = `web`**. `postinstall` runs
  `prisma generate`; `vercel-build` runs `prisma migrate deploy`, then `next build`.
- Env vars in Vercel: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`, `APPLE_CLIENT_ID`,
  `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `ALLOWED_EMAILS`.
- Step-by-step provider setup in `web/README.md`.

## Status

Implemented: everything in §1 "In v1". Verified with `npm run check`
(typecheck, lint, 37 tests including user-isolation tests against Postgres),
`npm run build`, and a browser run-through at iPhone size (import, start,
log/edit sets, finish, history, exercise progress). Not yet exercised: real
Google/Apple OAuth round-trips and a Vercel deployment, which need your
credentials (see `web/README.md`).

## 9. Toward multiple users

Already in place: user-owned rows, per-user uniqueness, user-scoped domain
functions, open sign-up behind an allow-list switch. Later: drop
`ALLOWED_EMAILS`, add account deletion and data export, rate limits on actions,
`user_id` on child tables if row-level security is ever wanted.

## Risks and decisions

| Risk / decision | Approach |
|---|---|
| Apple Sign In needs a paid Apple Developer account ($99/yr) and HTTPS | Google works without it; Apple is enabled only when its env vars exist. **Decide whether you want Apple at all**: it costs the same as the subscription you're replacing |
| Apple client secret expires (max 6 months) | Generated from the `.p8` key at startup, so it never goes stale |
| Apple sends the email only on first sign-in | Better Auth stores it on first sign-in; don't delete the account row |
| iOS evicts PWA storage after weeks without use | Data is server-side; the cache is only for offline viewing |
| Offline *logging* (not just viewing) | Out of scope for v1; would need a local queue + sync |
| Cache Components + session reads | Session read only inside `<Suspense>`; no `use cache` on user data yet |
| Neon cold start (~0.5 s after idle) | Acceptable for one user; can disable autosuspend on a paid plan |
