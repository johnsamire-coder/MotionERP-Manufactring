import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

/**
 * The single sanctioned entry point to PostgreSQL for the whole system.
 *
 * Business modules depend on THIS service (or, later, on a repository built on
 * top of it) — never on a raw pool of their own (Architecture Decisions D2 / D20).
 *
 * The pool connects lazily (no socket is opened until the first query), so the
 * app boots even when the database is down. Schema changes are handled only by
 * the migration engine (`migrator.ts`), never here.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  /** Low-level driver pool. Prefer `db` for queries. */
  readonly pool: Pool;

  /** Drizzle query interface. Module table schemas are registered in later phases. */
  readonly db: NodePgDatabase;

  constructor(config: AppConfigService) {
    this.pool = new Pool({ connectionString: config.databaseUrl, max: 5 });
    this.pool.on('error', (error) => {
      this.logger.error(`Idle PostgreSQL client error: ${error.message}`);
    });
    this.db = drizzle(this.pool);
  }

  async ping(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
