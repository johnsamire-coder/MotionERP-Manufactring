import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RequestContextMiddleware } from './request-context/request-context.middleware';

/**
 * Platform core: configuration, database connectivity and health checks.
 * Everything here is cross-cutting infrastructure, not a business domain.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
