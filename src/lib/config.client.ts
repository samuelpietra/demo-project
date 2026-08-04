import { useMemo } from "react";

export interface ClientConfig {
  environment: "development" | "test" | "staging" | "production";
}

function resolveClientEnv(key: string): string {
  if (!key.startsWith("VITE_")) throw new Error(`Client environment variable must start with "VITE_": ${key}`);
  if (typeof window !== "undefined") {
    const value = import.meta.env[key];
    if (value) return value;
  }
  const value = process.env[key];
  if (value) return value;
  throw new Error(`Missing environment variable: ${key}`);
}

let _clientConfig: ClientConfig | null = null;
export function getClientConfig(): ClientConfig {
  if (_clientConfig) return _clientConfig;
  if (typeof window === "undefined" || import.meta.env.VITE_ENVIRONMENT === "development") {
    _clientConfig = {
      environment: resolveClientEnv("VITE_ENVIRONMENT") as "development" | "test" | "staging" | "production",
    };
  } else {
    _clientConfig = {
      environment:
        window.APP_CONFIG?.environment ||
        (resolveClientEnv("VITE_ENVIRONMENT") as "development" | "test" | "staging" | "production"),
    };
  }
  console.log("Client configuration loaded:", _clientConfig);
  return _clientConfig;
}

export function useClientConfig(): ClientConfig {
  const config = useMemo(() => getClientConfig(), []);
  return config;
}

// Environments where demo tooling (seed logins, dev-only panels) is enabled:
// the non-shared tiers with no real data.
const DEMO_ENVIRONMENTS: readonly ClientConfig["environment"][] = ["development", "test"];

/** True when running in a demo-enabled environment (development / test). */
export function useIsDemoEnvironment(): boolean {
  const { environment } = useClientConfig();
  return useMemo(() => DEMO_ENVIRONMENTS.includes(environment), [environment]);
}
