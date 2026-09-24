import type { DatabaseService } from '../../core/database/database.service';
import type { AccountingRepository } from './accounting.repository';
import {
  AccountControlsService,
  MAIN_COST_CENTER_CODE,
  wrongSide,
} from './account-controls.service';

describe('Account controls (plan item 41)', () => {
  it('1. balance side: debit accounts may not go credit and vice versa; no rule = anything', () => {
    expect(wrongSide('debit', -5)).toBe(true);
    expect(wrongSide('debit', 0)).toBe(false);
    expect(wrongSide('credit', 5)).toBe(true);
    expect(wrongSide('credit', -5)).toBe(false);
    expect(wrongSide(null, -1e9)).toBe(false);
  });

  it('2. default cost center: kept when set, otherwise MAIN is created once and made the default', async () => {
    const org = '11111111-1111-1111-1111-111111111111';
    const centers: Array<{ id: string; orgNodeId: string; code: string; name: string }> = [];
    let config: { orgNodeId: string; defaultCostCenterId?: string | null } | null = null;
    const repo = {
      findAccountingOrgNode: jest.fn(async (id: string) => id),
      findCompanyConfig: jest.fn(async () => config),
      findCostCenterByCode: jest.fn(
        async (o: string, code: string) =>
          centers.find((c) => c.orgNodeId === o && c.code === code) ?? null,
      ),
      insertCostCenter: jest.fn(
        async (c: { id: string; orgNodeId: string; code: string; name: string }) => {
          centers.push(c);
          return c;
        },
      ),
      upsertCompanyConfig: jest.fn(
        async (c: { orgNodeId: string; defaultCostCenterId?: string }) => {
          config = { ...(config ?? {}), ...c };
          return config;
        },
      ),
    };
    const controls = new AccountControlsService(
      {} as DatabaseService,
      repo as unknown as AccountingRepository,
    );

    const first = await controls.ensureDefaultCostCenter(org);
    expect(centers).toHaveLength(1);
    expect(centers[0]!.code).toBe(MAIN_COST_CENTER_CODE);
    expect(first).toBe(centers[0]!.id);
    expect(config!.defaultCostCenterId).toBe(first);

    // second call: nothing new
    expect(await controls.ensureDefaultCostCenter(org)).toBe(first);
    expect(repo.insertCostCenter).toHaveBeenCalledTimes(1);

    // a chosen default is never replaced
    config = { orgNodeId: org, defaultCostCenterId: 'chosen' };
    expect(await controls.ensureDefaultCostCenter(org)).toBe('chosen');
  });
});
