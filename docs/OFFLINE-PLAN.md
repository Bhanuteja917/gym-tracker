# Gym Tracker PWA — Offline-first

Logging a workout never waits for the network. Every screen reads and writes a
copy of your data on the device (IndexedDB); changes go to the server through
a queue that is safe to retry. The service worker only makes the app *open*
offline. Code: `web/src/local/` (device), `web/src/server/sync.ts` and
`web/src/app/api/sync/` (server), `web/public/sw.js`.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Approach | Dexie (IndexedDB) on the device + an outbox + `/api/sync/push` and `/api/sync/pull` + the hand-written service worker. No Workbox/Serwist, no sync service. |
| Local data | A full copy of the user's data, so Workout, History, Exercises and progress all work offline. One database per account: `gym-<userId>`. |
| Ids | Created on the device (`crypto.randomUUID()`), so creating something twice is impossible. |
| Conflicts | Detected with a per-row `version`. The server's copy wins; the device keeps its losing change in **Settings → Sync → Changes not applied** with "Use mine" / "Dismiss". Deletion wins over edits. New records never conflict. |
| Cross-record rules | The server is strict on shape and ownership, lenient on rules between records: two workouts in progress (started on two devices) are allowed and the app says so; a duplicate exercise name created offline is renamed "Name (2)". |
| Settings | Default unit, attendance grid (3 or 6 months, optional start date) and the weekly plan sync as one record, last write wins. Older app versions that send only the unit leave the grid settings alone. |
| Set duration | `durationSec` on sets (timed sets like planks); a set needs reps or a time. |
| Platform | iOS 17+. No Background Sync on iOS: sync runs while the app is open. |

## Architecture

| Piece | Where | Job |
|---|---|---|
| App shell | `src/app/(app)/*` + `src/components/app-shell.tsx` | Every signed-in URL is the same static page with no user data. `AppShell` picks the screen from the URL; in-app links use `history.pushState` (`src/local/router.tsx`), so moving between screens never fetches anything. |
| Local database | `src/local/db.ts` | Tables `exercises`, `workouts`, `workoutExercises`, `sets` (each row has the server `version`, 0 = not on the server yet), `outbox`, `conflicts`, `meta` (pull cursor, last sync, default unit). |
| Local changes | `src/local/mutations.ts` | The domain rules (finish discards an empty workout, one workout at a time, unique names, no deleting exercises with history). Each change writes the row and its outbox entry in one transaction. |
| Outbox | `src/local/outbox.ts` | Full-record upserts and deletes. An entry never sent is updated in place (ten edits → one change); once sent it is never edited (a retry must mean the same thing). Deleting something that never reached the server just drops its entries. |
| Sync engine | `src/local/sync-engine.ts` | Push (oldest first, ≤100, one entry per record per batch) then pull until done. One sync at a time (Web Locks). Backoff 2 s → 5 s → 15 s → 1 min → 5 min. Triggers: launch, a local change (debounced 0.8 s), app to foreground, `online` event, every 60 s while visible, "Sync now". When the app goes to the background it sends a keepalive push. |
| Applying answers | `src/local/apply.ts` | A pulled row never overwrites a record with a queued change. Push results: applied → store the server copy (or rebase newer queued changes on the new version); conflict → save for review, show the server copy; rejected → mark Failed (Retry / Discard in Settings). |
| Account | `src/local/account.ts`, `src/local/provider.tsx` | The last account the server confirmed (localStorage) only chooses which local database to open. First launch asks the server (pull) who is signed in. |
| Push | `POST /api/sync/push` | Session check (Better Auth, against the DB), same-origin check, zod, `expectedUserId` must equal the session user (409 otherwise). Applies each mutation in a savepoint under a per-user advisory lock; records each mutation id in `sync_mutation` so a retry returns the stored result. |
| Pull | `GET /api/sync/pull?cursor=` | The user's rows (tombstones included) with `seq > cursor`, in one repeatable-read snapshot, paged. |
| Database | `prisma/migrations/20261015105802_offline_sync` | `version`, `seq`, `deletedAt` on the four tables; `userId` on child tables; a trigger sets `seq = nextval('sync_seq')` and bumps `version` on every write, so no write path can forget. Every writer holds the per-user lock, so a user's `seq` values commit in order and a pull never skips one. |
| Service worker | `public/sw.js` | Downloads every shell page and the JS/CSS it references at install; serves shells cache-first and refreshes them in the background on launch (all of them when a deploy changed the files). A shell is replaced only after its files are cached. Never touches `/api/*`. |

## Data flow

```
tap "Log set" ─► Dexie transaction: sets.put(row) + outbox.add(upsert, baseVersion)
                 └─► screen updates (live query); sync scheduled
sync: POST /api/sync/push  { expectedUserId, mutations[] }
        server: session → lock(user) → per mutation: seen id? → stored result
                                      zod → owner? → parent owned? → version == base?
                                      → apply (trigger: version+1, seq=next) → log id
        device: applied → drop entry, store server copy │ conflict → review list │ rejected → Failed
      GET /api/sync/pull?cursor=N  → rows with seq > N (one snapshot) → apply unless queued → cursor
no answer / timeout → keep the queue, "Offline · N pending", retry with backoff
401 → "Sign in to sync" (queue kept) │ 409 → another account signed in: switch, keep this account's data
```

## Sign-in and security

- Signed in, then offline: everything works from the device; only sign-in, the exercise library and sign-out need a connection.
- Session expired while offline: nothing changes until a sync gets 401; the queue is kept and the app shows "Sign in to sync". Signing in again as the same account resumes.
- A different account signs in on the device: its own database opens; the first account's unsynced changes stay in theirs, and the sign-in page says so.
- Sign out syncs first. With everything synced it deletes the account's local database. With changes unsynced (offline) it asks, and keeps them for that account.
- Every sync request validates the session and ownership on the server. The remembered account never authorizes anything. Another user's ids are answered as "not found".
- Data at rest is protected by the phone's encryption; the app doesn't add JavaScript-level encryption.

## iPhone limits that shape this

No Background Sync (sync only while open; keepalive flush when backgrounded) ·
the home-screen app has its own storage, separate from Safari (sign in inside
the app) · **removing the icon deletes its data** (Settings warns while
changes are pending) · storage is kept while the app is used; the app requests
`navigator.storage.persist()` · `navigator.onLine` is not trusted.

## Tests

- `src/server/sync.test.ts`: retries applied once, version conflicts, delete
  cascades and delete-wins, duplicate names, partial batch failures, user
  isolation (overwrite/attach/delete by id), paging.
- `src/app/api/sync/sync-routes.test.ts`: 401 (missing/forged cookie), 409
  account mismatch, 403 cross-site, 400/426.
- `src/local/local.test.ts`: real device code on fake-indexeddb against the real
  server functions: offline workout then sync, lost response, edit during push,
  drop never-sent, two devices (download, conflict, delete wins, queued edit vs
  pull), 401/409 keep the queue, rejected → retry/discard, unit sync.
- Browser run (Chromium, iPhone 13 size, production build): cold start offline,
  log a workout offline, tabs and back offline, relaunch offline, reconnect and
  sync, lost push response (no duplicates), second device + conflict + "Use
  mine", sign out with unsynced changes, another account on the same device.
- Still to do by hand on an iPhone: airplane mode at the gym, force-quit mid
  workout, lock the screen mid-set, a deploy while a workout is open.

## Later

Merge duplicate exercises (remap ids instead of renaming) · purge tombstones and
old `sync_mutation` rows by cron · Background Sync for Android/desktop ·
editing workout start/end times.
