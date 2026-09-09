import { Controller, Get } from '@nestjs/common';
import { PLATFORM_NAME } from '@motion-erp/shared';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseHealthIndicator, type DatabaseHealth } from '../database/database.health';

interface LivenessResponse {
  status: 'ok';
  platform: string;
  service: string;
  environment: string;
  timestamp: string;
}

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly databaseHealth: DatabaseHealthIndicator,
  ) {}

  @Get()
  liveness(): LivenessResponse {
    return {
      status: 'ok',
      platform: PLATFORM_NAME,
      service: 'motion-erp-api',
      environment: this.config.nodeEnv,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db')
  async database(): Promise<{ database: DatabaseHealth }> {
    return { database: await this.databaseHealth.check() };
  }
}
