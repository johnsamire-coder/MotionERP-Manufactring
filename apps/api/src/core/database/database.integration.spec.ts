import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { getMigrationStatus, runMigrations } from './migrator';

/**
 * Integration tests for the database layer. They need a reachable PostgreSQL
 * (via `pnpm run db:up`, which needs Docker, or any test database in
 * DATABASE_URL). When none is reachable the suite reports SKIPPED and passes,
 * so a developer without Docker is not blocked. CI always runs these against a
 * real postgres service.
 */
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const WORK_SCHEMA = 'motion_b21_integration';
const BOOKKEEPING_SCHEMA = 'motion_b21_bookkeeping';

async function canConnect(url: string): Promise<boolean> {
  if (!url) return false;
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 2500 });
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

async function dropTestSchemas(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    await pool.query(`drop schema if exists "${WORK_SCHEMA}" cascade`);
    await pool.query(`drop schema if exists "${BOOKKEEPING_SCHEMA}" cascade`);
  } finally {
    await pool.end();
  }
}

describe('database layer (integration, requires PostgreSQL)', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnect(DATABASE_URL);
    if (!dbAvailable) {
      console.warn(
        '[b-2-1] SKIPPED database integration tests: no reachable PostgreSQL at DATABASE_URL. ' +
          'Start one with `pnpm run db:up` (needs Docker) or point DATABASE_URL at a test database.',
      );
      return;
    }
    await dropTestSchemas();
  });

  afterAll(async () => {
    if (dbAvailable) await dropTestSchemas();
  });

  it('connects through pg and executes a query', async () => {
    if (!dbAvailable) return;

    const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
    try {
      const result = await pool.query<{ value: number }>('select 1 as value');
      expect(result.rows[0]?.value).toBe(1);
    } finally {
      await pool.end();
    }
  });

  it('applies a migration, records it, and is idempotent', async () => {
    if (!dbAvailable) return;

    const folder = mkdtempSync(join(tmpdir(), 'motion-migrations-'));
    mkdirSync(join(folder, 'meta'), { recursive: true });

    const when = Date.now();
    writeFileSync(
      join(folder, 'meta', '_journal.json'),
      JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [{ idx: 0, version: '7', when, tag: '0000_smoke', breakpoints: true }],
      }),
    );
    writeFileSync(
      join(folder, '0000_smoke.sql'),
      [
        `CREATE SCHEMA IF NOT EXISTS "${WORK_SCHEMA}";`,
        '--> statement-breakpoint',
        `CREATE TABLE IF NOT EXISTS "${WORK_SCHEMA}"."smoke" ("id" integer PRIMARY KEY);`,
      ].join('\n'),
    );

    const options = {
      databaseUrl: DATABASE_URL,
      migrationsFolder: folder,
      migrationsSchema: BOOKKEEPING_SCHEMA,
    };

    try {
      await runMigrations(options);

      const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
      try {
        const exists = await pool.query<{ present: boolean }>(
          `select to_regclass('"${WORK_SCHEMA}"."smoke"') is not null as present`,
        );
        expect(exists.rows[0]?.present).toBe(true);
      } finally {
        await pool.end();
      }

      const status = await getMigrationStatus(options);
      expect(status).toHaveLength(1);
      expect(status[0]?.tag).toBe('0000_smoke');
      expect(status[0]?.applied).toBe(true);

      // Running again must not fail and must not re-apply.
      await runMigrations(options);
      const afterSecondRun = await getMigrationStatus(options);
      expect(afterSecondRun).toHaveLength(1);
      expect(afterSecondRun[0]?.applied).toBe(true);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
