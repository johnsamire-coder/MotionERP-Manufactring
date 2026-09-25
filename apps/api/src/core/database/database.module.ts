import { Global, Module } from '@nestjs/common';
import { DatabaseHealthIndicator } from './database.health';
import { DatabaseService } from './database.service';

/**
 * Injection token used by later modules via @Inject('DRIZZLE'). It resolves to
 * the SAME Drizzle instance as DatabaseService.db, so the whole system still has
 * exactly one sanctioned connection pool (Architecture Decisions D2 / D20).
 */
export const DRIZZLE = 'DRIZZLE';

@Global()
@Module({
  providers: [
    DatabaseService,
    DatabaseHealthIndicator,
    {
      provide: DRIZZLE,
      useFactory: (database: DatabaseService) => database.db,
      inject: [DatabaseService],
    },
  ],
  exports: [DatabaseService, DatabaseHealthIndicator, DRIZZLE],
})
export class DatabaseModule {}
