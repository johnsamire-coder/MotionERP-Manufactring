import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

/**
 * Platform core: configuration, database connectivity and health checks.
 * Everything here is cross-cutting infrastructure, not a business domain.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule],
})
export class CoreModule {}
