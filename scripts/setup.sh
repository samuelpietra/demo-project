#!/bin/bash

set -e

# One-shot local setup: prepares everything needed to run the app, but does not
# start it. Safe to re-run — every step is idempotent, though seeding resets the
# demo data. Start the app afterwards with `bun run dev:local`.
#
# Output is plain ASCII on purpose: this runs on macOS, Linux, WSL and Git Bash,
# where colour support and Unicode rendering are not guaranteed.

COMPOSE_FILE="docker-compose.dev.yml"
ENV_FILE=".env.local"

step() {
  echo ""
  echo "==> $1"
}
ok() { echo "    [OK] $1"; }
fail() {
  echo "    [FAIL] $1" >&2
  exit 1
}

# Run a command quietly, but surface its full output if it fails — otherwise a
# broken step reports only our one-line message, with no detail to debug.
quietly() {
  local log
  log=$(mktemp)
  if ! "$@" >"$log" 2>&1; then
    cat "$log" >&2
    rm -f "$log"
    return 1
  fi
  rm -f "$log"
}

# --- 1. Preconditions ---------------------------------------------------------

step "Checking prerequisites"

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found. Run: cp .env.local.example $ENV_FILE"
docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker and try again."

# DATABASE_URL comes from .env.local so this script honours your configuration
# instead of hard-coding a connection string.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[ -n "$DATABASE_URL" ] || fail "DATABASE_URL is not set in $ENV_FILE"
ok "$ENV_FILE loaded"

# --- 2. Prisma client ---------------------------------------------------------

step "Generating Prisma client"
# prisma/generated is gitignored, so a fresh clone has no client at all, and
# every server module importing it fails to typecheck or run until this happens.
quietly bun run generate || fail "prisma generate failed (see output above)"
ok "Client generated at prisma/generated/client"

# --- 3. Database --------------------------------------------------------------

step "Starting PostgreSQL"
quietly docker compose -f "$COMPOSE_FILE" up -d postgres || fail "could not start the postgres container"

# `up -d` returns as soon as the container starts, which is before Postgres can
# accept connections — migrating immediately is a race.
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres >/dev/null 2>&1 ||
  fail "PostgreSQL did not become ready in 30s. Check: docker compose -f $COMPOSE_FILE logs postgres"
ok "PostgreSQL accepting connections"

step "Applying migrations"
quietly bunx prisma migrate deploy || fail "migrations failed (see output above)"
ok "Schema up to date"

step "Seeding demo data"
quietly bun prisma/seed.ts || fail "seeding failed (see output above)"
ok "Demo accounts and sample workouts created"

# --- 4. Verify ----------------------------------------------------------------

step "Type-checking"
quietly bun run typecheck || fail "type errors found (see output above)"
ok "No type errors"

# --- Done ---------------------------------------------------------------------

PORT_VALUE="${PORT:-3902}"

cat <<EOF

Setup complete.

  Start the app:  bun run dev:local
  Then open:      http://localhost:${PORT_VALUE}/sign-in

  Demo logins (password: demo1234)
    arnold@example.com   movements + workout history
    ronnie@example.com   movements + workout history
    john@example.com     empty account

  Run the e2e suite:  bun run test

EOF
