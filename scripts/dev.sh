#!/bin/bash

set -e

# Development script for the demo project
# Usage: ./scripts/dev.sh [up|down]

COMPOSE_FILE="docker-compose.dev.yml"

case "${1}" in
  "up")
    echo "Shutting down existing services..."
    docker compose -f $COMPOSE_FILE down
    echo "Starting full development environment with watch mode..."

    # Run tsr watch in background and docker compose watch in foreground
    bunx tsr watch &
    TSR_PID=$!

    # Trap to kill tsr watch when script exits
    trap "kill $TSR_PID 2>/dev/null" EXIT

    # Both files: .env carries PORT, which the compose port mapping interpolates.
    # Passing only .env.local replaces compose's default .env lookup, so the
    # mapping would fall back to 3000 while the app inside listens on PORT.
    USER_ID=$(id -u) GROUP_ID=$(id -g) docker compose --env-file ".env" --env-file ".env.local" -f $COMPOSE_FILE watch
    ;;
  "down")
    echo "Shutting down Docker services..."
    docker compose -f $COMPOSE_FILE down
    ;;
  *)
    echo "Usage: $0 [up|down]"
    echo "  up       - Start development environment"
    echo "  down      - Shut down all services"
    exit 1
    ;;
esac
