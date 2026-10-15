<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Gym Tracker web

Next.js PWA in `web/` (the repo root is the Expo app). Plan: `../docs/PWA-PLAN.md`.

- Every user-data function in `src/server/` takes `userId` first and filters by
  it (directly or through the owning workout). Pages and Server Actions get the
  user from `requireUser()`; never trust ids from the client or the proxy check.
- Server Actions live in `src/actions/`: `requireUser()` → zod-parse input →
  domain call via `attempt()` → `refresh()`.
- Cache Components are on: read the session/params only inside `<Suspense>`.
- Weights are stored as entered with their unit; convert only for display.
- Schema changes: edit `prisma/schema.prisma`, `npx prisma migrate dev --name …`;
  never edit a deployed migration.
- shadcn components are copied into `src/components/ui/` (the registry may be
  unreachable from sandboxes; sources are in github.com/shadcn-ui/ui
  `apps/v4/registry/new-york-v4/ui`).
- Run `npm run check` (typecheck, lint, tests) and `npm run build` before committing.
