/* eslint-disable no-console -- this is a CLI entry point; stdout is its interface */
import 'dotenv/config';
import { getMigrationStatus } from './migrator';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env first.');
    process.exit(1);
  }

  const rows = await getMigrationStatus({ databaseUrl });

  if (rows.length === 0) {
    console.log('No migrations in the journal yet.');
    return;
  }

  for (const row of rows) {
    const mark = row.applied ? 'applied' : 'pending';
    const at = row.appliedAt ? `  (recorded at ${row.appliedAt})` : '';
    console.log(`[${mark}] ${row.tag}${at}`);
  }

  const pending = rows.filter((row) => !row.applied).length;
  console.log(`\n${rows.length} migration(s), ${pending} pending.`);
}

main().catch((error: unknown) => {
  console.error(
    `Could not read migration status: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
