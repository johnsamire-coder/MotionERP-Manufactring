import { z } from 'zod';

/**
 * The single source of truth for which environment variables the API needs.
 * Startup fails fast with a readable message if anything is missing or invalid
 * (Architecture Decisions D28: configuration is explicit and validated).
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    API_GLOBAL_PREFIX: z.string().min(1).default('api'),
    API_CORS_ORIGINS: z.string().default('http://localhost:5173'),
    DATABASE_URL: z.string().url(),
    // Authentication (plan item 5.0). The secret signs login tokens; required in production.
    AUTH_JWT_SECRET: z.string().min(32).optional(),
    AUTH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(8 * 60 * 60),
    // Plan item 5.3 (owner's decision): every request without a valid token is rejected (401).
    // On by default; "false" only for local experiments and the tests that predate login.
    AUTH_ENFORCE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    // First administrator, created at startup when that username does not exist yet (never
    // overwritten afterwards). Needed once to log in on a fresh database while AUTH_ENFORCE is on.
    AUTH_BOOTSTRAP_USERNAME: z.string().min(3).optional(),
    AUTH_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
    /** Plan item 37: minutes between automatic ledger-health runs (0 = only on demand). */
    LEDGER_HEALTH_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(0),
    /** Plan item 43: minutes between helpdesk sweeps (missed SLAs, auto-close); 0 = on demand only. */
    SUPPORT_SWEEP_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(0),
    /** Plan item 44: outgoing mail (smtp://… or smtps://user:pass@host:465). Unset = e-mails stay queued. */
    SMTP_URL: z.string().url().optional(),
    SMTP_FROM: z.string().default('erp@motion.local'),
    /** Plan item 44: minutes between project status-report runs; 0 = on demand only. */
    PROJECT_REPORT_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(0),
    /** Plan item 48: Egyptian e-invoicing (ETA) credentials — unset = documents are prepared but not submitted. */
    ETA_ID_SRV_URL: z.string().url().optional(),
    ETA_API_URL: z.string().url().optional(),
    ETA_CLIENT_ID: z.string().optional(),
    ETA_CLIENT_SECRET: z.string().optional(),
  })
  .refine((env) => !env.AUTH_BOOTSTRAP_USERNAME === !env.AUTH_BOOTSTRAP_PASSWORD, {
    message: 'AUTH_BOOTSTRAP_USERNAME and AUTH_BOOTSTRAP_PASSWORD go together',
    path: ['AUTH_BOOTSTRAP_PASSWORD'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.AUTH_JWT_SECRET, {
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
