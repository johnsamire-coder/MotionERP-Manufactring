/*
 * Local-only test helper: runs the given commands with DATABASE_URL pointed at a
 * throwaway, in-userland PostgreSQL (no Docker needed). Used to execute the
 * integration + e2e suites on a dev machine where Docker is unavailable.
 *
 * CI does not use this — it runs against its own `postgres:16` service.
 *
 * Usage:  node scripts/test-with-db.mjs "jest" "jest --config ./test/jest-e2e.json"
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

// A fresh data directory per run keeps PostgreSQL's shared-memory key unique and
// avoids "pre-existing shared memory block is still in use" from an earlier run.
const dataDir = mkdtempSync(join(tmpdir(), 'motion-pg-'));
// Stay in a low, registered band: the Windows ephemeral range (49152+) is
// riddled with Hyper-V / WinNAT reserved sub-ranges that reject bind().
const port = Number(process.env.MOTION_TEST_PG_PORT ?? 15400 + Math.floor(Math.random() * 200));
const password = 'motion_test';
const database = 'motion_erp_test';
const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;

console.log(`starting embedded PostgreSQL: port=${port} dataDir=${dataDir}`);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password,
  port,
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

let started = false;
let failed = false;

try {
  await pg.initialise();
  await pg.start();
  started = true;
  await pg.createDatabase(database);
  console.log(`\nembedded PostgreSQL ready on 127.0.0.1:${port} (db: ${database})\n`);

  for (const command of process.argv.slice(2)) {
    console.log(`\n$ ${command}\n`);
    try {
      execSync(command, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl } });
    } catch {
      failed = true;
    }
  }
} catch (error) {
  console.error('embedded PostgreSQL failed:', error);
  failed = true;
} finally {
  if (started) {
    try {
      await pg.stop();
    } catch {
      /* ignore shutdown noise */
    }
  }
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

process.exit(failed ? 1 : 0);
