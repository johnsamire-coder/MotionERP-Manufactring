import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.validation';

/**
 * Typed accessor over validated configuration. Application code depends on this,
 * never on `process.env` directly.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('API_PORT', { infer: true });
  }

  get globalPrefix(): string {
    return this.config.get('API_GLOBAL_PREFIX', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config
      .get('API_CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  /** Undefined outside production when not configured; a per-process secret is used then. */
  get authJwtSecret(): string | undefined {
    return this.config.get('AUTH_JWT_SECRET', { infer: true });
  }

  get authTokenTtlSeconds(): number {
    return this.config.get('AUTH_TOKEN_TTL_SECONDS', { infer: true });
  }

  get authEnforce(): boolean {
    return this.config.get('AUTH_ENFORCE', { infer: true });
  }

  get ledgerHealthIntervalMinutes(): number {
    return this.config.get('LEDGER_HEALTH_INTERVAL_MINUTES', { infer: true });
  }
}
