/* eslint-disable no-console -- this is a CLI entry point; stdout is its interface */
import 'dotenv/config';
import { runMigrations } from './migrator';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env first.');
    process.exit(1);
  }

  await runMigrations({ databaseUrl });
  console.log('OK: all pending migrations applied.');
}

main().catch((error: unknown) => {
  // Never print the connection string; the driver's message is enough.
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
