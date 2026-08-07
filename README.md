# Better Bookkeeping Demo App

A simple workout tracking app built with TanStack Start. Users can configure movements (e.g. bench-press, dumbbell curls), create workouts with sets, and view their workout history.

## Feature Requests

1. Add weight tracking section where a user can input their weight. This should be something they can track over time. Add a chart showing the history of that

2. The current setup doesn't support body-weight movements very well (e.g. pullups / pushups) update the "movements page" so a user can flag a movement as "body-weight" when they create it. When a "body-weight" movement is added to the current workout the weight field should default to the most recent user-inputted weight

3. The Workout history should give the user a sense of progression. One way to do this is to show certain summary metrics for each movement and their progression over time. Please implement a chart where a user can select a movement and a corresponding metric and see that metric plotted against time.
   Metrics:
   - maximum weight (the maximum weight for that movement on a given day)
   - total reps
   - total volume (volume of a set is weight \* reps, total volume for a movement is total volume of all sets in a workout)

4. There are no tests! Please implement the e2e tests in the `e2e/` directory using Playwright. The test scaffolding is already set up - you just need to implement the test cases:
   - `e2e/movements.spec.ts` - Movement CRUD operations
   - `e2e/sets.spec.ts` - Set CRUD operations
   - `e2e/workouts.spec.ts` - Workout CRUD operations

5. **Security Fix**: The authentication system stores passwords in plaintext. Please implement proper password hashing using a secure algorithm (e.g., bcrypt, argon2). Update the sign-up and sign-in flows accordingly.

### Stretch Goals

- Get creative - how would you add nutrition tracking to this app? Macros (Carb / Protein / Fats) and Calories & Calorie surplus/deficit
- Database design / performance upgrade - let us know what we're doing wrong. Show us how you would tackle harder problems like admin boards to summarize users in the system
- Security audit / improvement - beyond password hashing, what other security improvements would you make? Consider things like rate limiting, CSRF protection, or session management
- General UI cleanup / update - the UI here is totally basic. Show us some improvements you'd make to make this app look clean and professional

There will be a code review on what you write! So be prepared to explain how and why you implemented these features.

Please use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) as you're working on this repo.

## Tech Stack

- **Framework**: TanStack Start (React SSR)
- **Router**: TanStack Router (file-based routing)
- **State Management**: TanStack Query + TanStack Form
- **Database**: PostgreSQL + Prisma
- **Styling**: Tailwind CSS v4
- **Runtime**: Bun
- **Testing**: Playwright (e2e)

## Development

### Prerequisites

- Bun runtime installed
- Docker (for PostgreSQL)
- Node.js 22 — required only for the Playwright e2e test runner (`bun run test` runs Playwright under Node; without Node the runner can't spawn its workers). An `.nvmrc` is included, so `nvm use` selects the right version.

### Getting Started

```bash
# Install dependencies
bun install

# Create your local environment file (gitignored) — required, see Environment below
cp .env.local.example .env.local

# Start development server with Docker (includes PostgreSQL)
bun run dev

# Stop services
bun run dev:down
```

### Environment

`.env` holds committed, non-secret configuration. Everything else lives in `.env.local`,
which is gitignored — copy `.env.local.example` to create it.

The server validates its environment at boot (`src/lib/env.server.ts`) and **fails fast**:
a missing or invalid value throws on startup rather than silently degrading a
security check at runtime. Required variables:

| Variable        | Purpose                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`   | One of `development` \| `test` \| `staging` \| `production`. Gates dev-only UI.                                                                                                                                                                          |
| `DATABASE_URL`  | PostgreSQL connection string.                                                                                                                                                                                                                            |
| `COOKIE_SECRET` | HMAC key for session cookies. **No default on purpose** — a fallback baked into the source would be public, which would make every session token forgeable. Generate one with `openssl rand -hex 32`, and set a distinct value per deployed environment. |

Security findings, fixes, and accepted risks are documented in [SECURITY-AUDIT.md](./SECURITY-AUDIT.md).
Notes on the nutrition and database stretch goals are in [STRETCH-GOALS.md](./STRETCH-GOALS.md).

### Running locally (recommended for development)

```bash
nvm use                                                    # Node 22 (Playwright test runner)
bun install
cp .env.local.example .env.local                           # local env (gitignored)
bun run setup                                              # Postgres, Prisma client, migrations, demo data
bun run dev:local                                          # run the app at http://localhost:3902
```

Then open http://localhost:3902 and use a demo login from the sign-in page.

### Running the tests

```bash
nvm use                            # Node 22 is required for the Playwright test runner
bunx playwright install chromium   # once per machine — Playwright uses its own browser build
bun run test                       # Playwright e2e suite (boots the app automatically)
```

### Available Scripts

- `bun run setup` - One-shot local setup: Prisma client, Postgres, migrations, demo data, typecheck. Doesn't start the app.
- `bun run dev` - Start development server with Docker
- `bun run dev:down` - Stop Docker services
- `bun run dev:local` - Run the app locally (Vite) against Dockerized Postgres, without rebuilding the app container. Run `bun run setup` first.
- `bun run generate` - Generate the Prisma client and the router's route tree (both gitignored)
- `bun run format` - Format the codebase with Prettier
- `bun run serve` - Preview a production build (run `bun run build` first)
- `bun run build` - Build for production
- `bun run test` - Run e2e tests with Playwright
- `bun run test:ui` - Run e2e tests with Playwright UI
- `bun run typecheck` - Run TypeScript type checking
- `bun run db:migrate` - Run database migrations
- `bun run db:seed` - Seed the database with demo users and sample data

## Demo Accounts

Run `bun run db:seed` to populate the database with three demo users (all with password `demo1234`):

| Email                | Password   | Data                                   |
| -------------------- | ---------- | -------------------------------------- |
| `arnold@example.com` | `demo1234` | Movements + workout history            |
| `ronnie@example.com` | `demo1234` | Movements + workout history            |
| `john@example.com`   | `demo1234` | Empty account (for fresh/empty states) |

In the `development` and `test` environments, the sign-in page shows a panel with one-click logins for these accounts.

## Project Structure

```
src/
├── routes/           # File-based routing
├── components/       # Reusable components
└── lib/              # Business logic & server functions
prisma/
├── schema.prisma     # Database schema
└── migrations/       # Database migrations
```
