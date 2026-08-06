# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A workout tracking app: users configure **movements** (e.g. bench press), record **workouts** made of **sets** (reps × weight), and review their **workout history**. Built with TanStack Start (React SSR).

## Development Commands

This project uses **Bun** as the package manager and runtime.

- `bun install` - Install dependencies
- `bun run generate` - Generate the Prisma client. **Run this before the first local start** — the generated client lives at `prisma/generated/client` and is not committed; if it is missing, SSR fails with a confusing `serverFn is not a function` error (server modules fail to import).
- `bun run dev` - Full Docker dev environment (app + Postgres) via `scripts/dev.sh`, with route-tree and container watch.
- `bun run dev:local` - Run the app locally with Vite against a Dockerized Postgres, without rebuilding the app container. Start Postgres first: `docker compose -f docker-compose.dev.yml up -d postgres`.
- `bun run dev:down` - Stop Docker services.
- `bun run db:migrate` - Apply Prisma migrations to the local Postgres.
- `bun run typecheck` - TypeScript type checking (`tsc --noEmit`).
- `bun run test` / `bun run test:ui` - Playwright e2e tests.
- `bun run build` - Production build (Vite).

### Ports & environment notes

- The app serves on **port 3902** (set by `PORT` in `.env`), not 3000. The `.env` `PORT` overrides Vite's `--port` flag.
- `.env` ships committed config-only values and defaults `DATABASE_URL` to SQLite; the app actually targets **PostgreSQL**. Override secrets/URLs in `.env.local` (gitignored). See `.env.local.example`.
- Server env (`ENVIRONMENT`, `DATABASE_URL`, `COOKIE_SECRET`) is Zod-validated once at boot in `env.server.ts` and fails fast when anything is missing. `dev:local` passes `ENVIRONMENT`/`DATABASE_URL` inline, but `COOKIE_SECRET` has no default and comes from `.env.local` — so that file must exist before the first run (`cp .env.local.example .env.local`).

## Architecture

### Tech Stack

- **Framework**: TanStack Start (React 19 SSR)
- **Router**: TanStack Router (file-based; auto-generates `src/routeTree.gen.ts`, not committed)
- **Server state**: TanStack Query · **Forms**: TanStack Form
- **Database**: PostgreSQL + Prisma 7 via the `@prisma/adapter-pg` driver adapter
- **Styling**: Tailwind CSS v4 (Vite plugin) + local shadcn-style primitives in `src/components/ui`
- **Charts**: Recharts · **Auth**: `bcryptjs` password hashing + signed cookie sessions
- **Runtime**: Bun · **Testing**: Playwright (e2e; the runner needs Node 22 — see `.nvmrc`)
- **TypeScript**: strict, path alias `@/*` → `./src/*`

### Project Structure

- `src/routes/` - File-based routing.
  - `sign-in`, `create-account`, `logout` - auth pages/actions.
  - `__index/_layout.*` - the authenticated app: `movements`, `current-workout`, `workout-history`, `weight`. Route-local queries live in `-queries/` folders.
  - `api/health` - health check.
- `src/lib/` - Server functions and infrastructure. Files named `*.server.ts` are server-only.
  - `auth.server.ts` - session auth (sign in/up, logout, `authMiddleware`).
  - `movements.server.ts`, `workouts.server.ts`, `weight.server.ts` - domain server functions.
  - `db.server.ts` - lazily-constructed Prisma client (pg adapter), built from the validated server env.
  - `env.server.ts` - Zod-validated server environment, parsed once at boot (fail-fast).
  - `config.client.ts` - client config + `useIsDemoEnvironment` (dev/test-only UI gating).
  - `demo-accounts.ts` - seeded demo logins surfaced on the sign-in page outside production.
- `src/components/ui/` - Local UI primitives (button, card, input, select, etc.).
- `prisma/` - `schema.prisma`, `migrations/`, and generated client (`generated/`, gitignored).

### Server functions

Domain logic is exposed via TanStack Start server functions:

```ts
export const doThingServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware]) // guards authenticated routes
  .inputValidator(
    z.object({
      /* ... */
    }),
  ) // Zod validation of input
  .handler(async ({ context, data }) => {
    /* context.user is available */
  });
```

`authMiddleware` (in `auth.server.ts`) loads the user from the signed session cookie and redirects to `/sign-in` if absent.

### Data model (`prisma/schema.prisma`)

- `User` - id, email (unique), name, `password` (bcrypt hash), timestamps; has many `Workout`, `Movement`, `WeightEntry`.
- `Movement` - belongs to a `User`; `name`, `isBodyweight`. Unique on `[userId, name]`, so names are per-user, not global.
- `Workout` - belongs to a `User`; `completedAt: null` marks the single active workout; has many `Set`.
- `Set` - belongs to a `Workout` and a `Movement`; `reps: Int`, `weight: Int`.
- `WeightEntry` - belongs to a `User`; `weight: Float`, `recordedAt`. Indexed on `[userId, recordedAt]` for history queries.

**Every user-owned model is scoped by `userId`**; domain server functions filter on `context.user.id` rather than trusting a client-supplied id.

### Auth model

Cookie-based sessions. On sign in/up, a token `"{userId}.{HMAC(userId)}"` is stored in an httpOnly cookie signed with `COOKIE_SECRET`. `getUserServerFn` verifies the signature and loads the user. Passwords are hashed with `bcryptjs`; sign-in runs a compare against a dummy hash when the user is missing, so response timing doesn't leak account existence.

Known limitation: the token embeds no timestamp, so expiry is only the cookie's 7-day `expires` and there is no server-side revocation.

## Conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/).
- ast-grep is available in this environment. For syntax-aware / structural searches, prefer `ast-grep run --lang tsx -p '<pattern>'` (set `--lang` appropriately) over text-only tools like `rg`/`grep` unless a plain-text search is explicitly wanted.
