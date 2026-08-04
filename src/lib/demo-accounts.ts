/**
 * Demo accounts for local development, tests, and reviewers.
 *
 * The plaintext passwords here are intentional and safe: these are throwaway,
 * intentionally-public demo credentials (also documented in the README), used
 * only to make the seeded app easy to explore. The sign-in panel that shows
 * them is gated to the `development` and `test` environments, so it is not
 * rendered in staging/production. The seed script hashes these passwords like
 * any real user.
 *
 * Single source of truth: the seed script creates these users, and the dev
 * sign-in panel reads the same list to offer one-click logins.
 */
export interface DemoAccount {
  name: string;
  email: string;
  password: string;
  description: string;
}

// Environments allowed to see/use demo tooling (matches the app's non-shared,
// no-real-data tiers).
export const DEMO_ENVIRONMENTS: readonly string[] = ["development", "test"];

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Arnold Schwarzenegger",
    email: "arnold@example.com",
    password: "demo1234",
    description: "Movements + workout history (progression data)",
  },
  {
    name: "Ronnie Coleman",
    email: "ronnie@example.com",
    password: "demo1234",
    description: "Movements + workout history (progression data)",
  },
  {
    name: "John Doe",
    email: "john@example.com",
    password: "demo1234",
    description: "Empty account — fresh/empty states",
  },
];
