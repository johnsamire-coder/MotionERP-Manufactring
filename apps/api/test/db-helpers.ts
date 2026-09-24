import { Pool } from 'pg';

/** True when a PostgreSQL is reachable at `url` (suites skip, and pass, without one). */
export async function canConnect(url: string): Promise<boolean> {
  if (!url) return false;
  const probe = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 2500 });
  try {
    await probe.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end();
  }
}

/** Drops every non-system schema, so a suite can apply all migrations to an empty database. */
export async function dropAllSchemas(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ nspname: string }>(
    `select nspname from pg_namespace
     where nspname not like 'pg\\_%' and nspname not in ('information_schema', 'public')`,
  );
  for (const { nspname } of rows) await pool.query(`drop schema if exists "${nspname}" cascade`);
}
