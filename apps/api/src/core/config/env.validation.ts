import { z } from 'zod';

/**
 * The single source of truth for which environment variables the API needs.
 * Startup fails fast with a readable message if anything is missing or invalid
 * (Architecture Decisions D28: configuration is explicit and validated).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_GLOBAL_PREFIX: z.string().min(1).default('api'),
  API_CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),
  // Authentication (plan item 5.0). The secret signs login tokens; required in production.
  AUTH_JWT_SECRET: z.string().min(32).optional(),
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(8 * 60 * 60),
  // When "true", every request without a valid token is rejected (401). Off by default so
  // existing screens keep working until the owner switches it on.
  AUTH_ENFORCE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /** Plan item 37: minutes between automatic ledger-health runs (0 = only on demand). */
  LEDGER_HEALTH_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(0),
  /** Plan item 43: minutes between helpdesk sweeps (missed SLAs, auto-close); 0 = on demand only. */
  SUPPORT_SWEEP_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(0),
  /** Plan item 44: outgoing mail (smtp://… or smtps://user:pass@host:465). Unset = e-mails stay queued. */
  SMTP_URL: z.string().url().optional(),
  SMTP_FROM: z.string().default('erp@motion.local'),
  /** Plan item 44: minutes between project status-report runs; 0 = on demand only. */
  PROJECT_REPORT_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(0),
}).refine((env) => env.NODE_ENV !== 'production' || !!env.AUTH_JWT_SECRET, {
  message: 'AUTH_JWT_SECRET is required in production',
  path: ['AUTH_JWT_SECRET'],
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
