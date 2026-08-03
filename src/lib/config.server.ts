import { serverEnv } from "./env.server";

class AppConfigService<ConfigType> {
  private config: ConfigType;
  constructor(inputFig: ConfigType) {
    this.config = inputFig;
  }
  isInitialized() {
    return !!this.config;
  }
  initialize() {
    this.config = this.config;
  }
  getAppConfig() {
    return this.config;
  }
}

export const configService = new AppConfigService({
  environment: serverEnv.ENVIRONMENT,
  database: { url: serverEnv.DATABASE_URL },
});
