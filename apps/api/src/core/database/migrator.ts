import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Platform migration engine.
 *
 * Wraps Drizzle's node-postgres migrator so the same code path is used by the
 * `db:migrate` / `db:status` CLIs and by tests. The running application never
 * calls this — migrations are applied deliberately (Architecture Decisions D7 / D21).
 */

/** Schema that holds Drizzle's own bookkeeping table (`__drizzle_migrations`). */
export const DEFAULT_MIGRATIONS_SCHEMA = 'drizzle';
const BOOKKEEPING_TABLE = '__drizzle_migrations';

export interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints?: boolean;
}

export interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

export interface MigrationStatusRow {
  tag: string;
  when: number;
  applied: boolean;
  appliedAt: string | null;
}

export interface MigratorOptions {
  databaseUrl: string;
  /** Defaults to `<cwd>/drizzle/migrations` (cwd is the api package root). */
  migrationsFolder?: string;
  migrationsSchema?: string;
}

export function defaultMigrationsFolder(): string {
  return resolve(process.cwd(), 'drizzle', 'migrations');
}

export function readJournal(migrationsFolder: string = defaultMigrationsFolder()): Journal {
  const raw = readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8');
  return JSON.parse(raw) as Journal;
}

/**
 * Pure merge of the on-disk journal with the set of applied `when` timestamps
 * (as strings, because the bookkeeping column is a bigint). Extracted so it can
 * be unit-tested without a database.
 */
export function mergeMigrationStatus(
  entries: readonly JournalEntry[],
  appliedWhen: ReadonlySet<string>,
): MigrationStatusRow[] {
  return [...entries]
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => {
      const applied = appliedWhen.has(String(entry.when));
      return {
        tag: entry.tag,
        when: entry.when,
        applied,
        appliedAt: applied ? new Date(entry.when).toISOString() : null,
      };
    });
}

/** Apply every pending migration, in order. Idempotent. */
export async function runMigrations(options: MigratorOptions): Promise<void> {
  const pool = new Pool({
    connectionString: options.databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: options.migrationsFolder ?? defaultMigrationsFolder(),
      migrationsSchema: options.migrationsSchema ?? DEFAULT_MIGRATIONS_SCHEMA,
    });
  } finally {
    await pool.end();
  }
}

/** Report which migrations from the journal have been applied. */
export async function getMigrationStatus(options: MigratorOptions): Promise<MigrationStatusRow[]> {
  const schema = options.migrationsSchema ?? DEFAULT_MIGRATIONS_SCHEMA;
  const journal = readJournal(options.migrationsFolder);

  const pool = new Pool({
    connectionString: options.databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    let appliedWhen: string[] = [];
    try {
      const result = await pool.query<{ created_at: string }>(
        `select "created_at" from "${schema}"."${BOOKKEEPING_TABLE}" order by "created_at"`,
      );
      appliedWhen = result.rows.map((row) => String(row.created_at));
    } catch {
      // The bookkeeping table does not exist yet -> nothing has been applied.
    }
    return mergeMigrationStatus(journal.entries, new Set(appliedWhen));
  } finally {
    await pool.end();
  }
}
