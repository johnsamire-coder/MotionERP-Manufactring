import { Test } from '@nestjs/testing';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseHealthIndicator } from '../database/database.health';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const databaseHealth = { check: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: AppConfigService, useValue: { nodeEnv: 'test' } },
        { provide: DatabaseHealthIndicator, useValue: databaseHealth },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('reports liveness as ok with a valid ISO timestamp', () => {
    const response = controller.liveness();

    expect(response.status).toBe('ok');
    expect(response.platform).toBe('Motion ERP');
    expect(response.service).toBe('motion-erp-api');
    expect(response.environment).toBe('test');
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
  });

  it('surfaces the database health indicator result', async () => {
    databaseHealth.check.mockResolvedValue({ status: 'up' });

    await expect(controller.database()).resolves.toEqual({ database: { status: 'up' } });
    expect(databaseHealth.check).toHaveBeenCalledTimes(1);
  });
});
