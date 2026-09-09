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
}
