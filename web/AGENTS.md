<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Gym Tracker web

Next.js PWA in `web/` (the repo root is the Expo app). Plan: `../docs/PWA-PLAN.md`.

- Offline-first (`../docs/OFFLINE-PLAN.md`): screens in `src/screens/` read the
  on-device Dexie database (`src/local/queries.ts`) and change it only through
  `src/local/mutations.ts` (row + outbox entry in one transaction), via
  `useLocal().mutate`. Never call the server from a screen to change data.
- App pages under `src/app/(app)/` are static shells with no user data; links
  between screens use `AppLink`/`navigate` (pushState), not `next/link`.
- New synced fields: add to the Prisma model, `src/lib/sync-protocol.ts`
  (schema + wire type), `toWire` in `src/server/sync.ts`, `toData`/`fromWire` in
  `src/local/outbox.ts`, and the Dexie types. Never change an existing
  `this.version(n)` in `src/local/db.ts`; add a new one.
- Server writes to synced tables go through `withUserLock()` (`src/server/sync.ts`)
  and scope by `userId`; the session is validated on every sync request.
- Cache Components are on: read the session/params only inside `<Suspense>`.
- Weights are stored as entered with their unit; convert only for display.
- Schema changes: edit `prisma/schema.prisma`, `npx prisma migrate dev --name …`;
  never edit a deployed migration.
- shadcn components are copied into `src/components/ui/` (the registry may be
  unreachable from sandboxes; sources are in github.com/shadcn-ui/ui
  `apps/v4/registry/new-york-v4/ui`).
- Run `npm run check` (typecheck, lint, tests) and `npm run build` before committing.
