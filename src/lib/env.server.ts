import { z } from "zod";

/**
 * Server-side environment variables, validated once at startup.
 *
 * These are server-only and must NOT use the `VITE_` prefix (that prefix
 * exposes a variable to the browser bundle). Validation is fail-fast: if a
 * value is missing or invalid, the process throws at boot instead of letting
 * a bad value silently flow into runtime logic (e.g. an environment-based
 * security gate).
 */
const serverEnvSchema = z.object({
  ENVIRONMENT: z.enum(["development", "test", "staging", "production"]),
  DATABASE_URL: z.string().min(1),
  // No default on purpose: a fallback would be public in the source, which
  // makes every session token forgeable.
  COOKIE_SECRET: z.string().min(1),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid server environment configuration:\n${details}`);
}

export const serverEnv = parsed.data;
