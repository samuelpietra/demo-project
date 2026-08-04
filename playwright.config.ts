import { defineConfig, devices } from "@playwright/test";

// Single source of truth: the app's port comes from PORT in .env (bun auto-loads
// it when running `bun run test`). The fallback keeps this working if the config
// is ever evaluated outside bun.
const port = process.env.PORT ?? "3902";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    // Boots the app for the tests; reuses an already-running dev server locally.
    // Requires Postgres to be up (docker compose -f docker-compose.dev.yml up -d postgres).
    command: "bun run dev:local",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
