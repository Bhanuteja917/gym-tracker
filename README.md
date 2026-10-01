# Gym Tracker

A simple personal workout log for iPhone (Android later). Log exercises and sets
during a gym session; everything stays on the phone in a local SQLite database.
No accounts, no cloud.

- **Stack:** Expo SDK 57 · TypeScript · Expo Router · expo-sqlite · Drizzle ORM
- **Plan and decisions:** [docs/PLAN.md](docs/PLAN.md)

## Features

- Start a workout, add exercises, log sets (weight × reps, optional RPE and notes)
- Enter each set in **lb or kg** (default lb, changeable in Settings)
- The next set is pre-filled from the previous one, and each exercise shows what you did last time
- Rest between sets is recorded automatically from the time each set is logged
- History of workouts; per-exercise history and best set
- Plan your week: name each day, add exercises with targets, and start a planned workout from the Workout tab
- Track calories and macros: log food by day, save common foods, set daily targets
- Export a JSON backup or a CSV of all sets; restore from a JSON backup

## Development

Requires Node 20+ and, for building to a phone, a Mac with Xcode.

```sh
npm install
npm run check      # typecheck + lint + unit tests
npx expo start     # dev server — scan the QR code with the Expo Go app
```

Expo Go (free on the App Store) runs the app with hot reload and no signing.
Its data is separate from the installed app, so use it for trying changes, not
for your real log.

### Changing the database

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate` to create a migration in `drizzle/`.
3. Migrations run automatically when the app starts.

Never edit a migration that has already run on your phone; add a new one.

## Installing on your iPhone (free Apple ID)

One-time setup:

1. Install Xcode, open it, and sign in with your Apple ID under
   **Xcode → Settings → Accounts**.
2. Plug in the iPhone and tap **Trust** on the phone.
3. Generate the native project and open it:
   ```sh
   npx expo prebuild --platform ios
   open ios/*.xcworkspace
   ```
4. In Xcode, select the app target (**GymTracker**) → **Signing & Capabilities** →
   set **Team** to your *Personal Team*. If Xcode says the bundle identifier is
   taken, change `ios.bundleIdentifier` in `app.json` (e.g. add a suffix), then
   rerun step 3.
5. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode**
   (it appears after the phone has been connected to Xcode) and restart.

Build and install a standalone release build (no laptop needed afterwards):

```sh
npm run ios:device
```

The first time you open the app, iOS asks you to trust the developer:
**Settings → General → VPN & Device Management →** your Apple ID → **Trust**.

### Every 7 days

Free-account builds expire after 7 days (the app stops opening). Plug in the
phone and run `npm run ios:device` again. Your data is kept, because the app is
reinstalled over itself with the same bundle identifier.

**Don't delete the app to fix problems** — deleting it deletes your data.
Export a backup from Settings first.
