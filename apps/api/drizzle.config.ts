import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration (used only by the CLI: `db:generate`, `db:check`).
 *
 * - `schema` points at the single barrel where every module re-exports its
 *   table definitions, so drizzle-kit sees one aggregated schema.
 * - `out` is the committed, reviewable migrations folder.
 * - Migrations are NEVER applied automatically by the running app — only via
 *   the explicit `db:migrate` command (Architecture Decisions D7 / D21).
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/core/database/schema/index.ts',
  out: './drizzle/migrations',
  strict: true,
  verbose: true,
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
});
