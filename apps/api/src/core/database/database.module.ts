import { Global, Module } from '@nestjs/common';
import { DatabaseHealthIndicator } from './database.health';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService, DatabaseHealthIndicator],
  exports: [DatabaseService, DatabaseHealthIndicator],
})
export class DatabaseModule {}
