import { ClientConfig } from "./lib/config.client";

declare global {
  interface Window {
    APP_CONFIG: ClientConfig;
  }
}
