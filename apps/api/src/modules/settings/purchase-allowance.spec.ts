import type { DatabaseService } from '../../core/database/database.service';
import type { OrganizationService } from '../organization/organization.service';
import { PurchaseAllowanceService } from './purchase-allowance.service';

describe('Purchase over-allowances (plan item 12)', () => {
  it('1. limit(): ordered 100 with 10% → 110; 0% → exact', () => {
    expect(PurchaseAllowanceService.limit(100, 10)).toBeCloseTo(110);
    expect(PurchaseAllowanceService.limit(100, 0)).toBe(100);
  });

  it('2. resolve(): the nearest configured org node wins, then global, then zero', async () => {
    const rows = new Map<string | null, { overOrderPct: string; overReceiptPct: string; overBillingPct: string }>();
    const db = {
      db: {
        select: () => ({ from: () => ({ where: (cond: { key: string | null }) => ({ limit: async () => {
          const r = rows.get(cond.key);
          return r ? [{ orgNodeId: cond.key, ...r }] : [];
        } }) }) }),
      },
    } as unknown as DatabaseService;
    const org = {
      getAncestors: jest.fn().mockResolvedValue({ node: { id: 'branch' }, ancestors: [{ id: 'company' }, { id: 'group' }] }) // root first,
    } as unknown as OrganizationService;
    const service = new PurchaseAllowanceService(db, org);
    // Route the drizzle condition to a key: spy on the private find() instead of building SQL.
    const find = jest.spyOn(service as unknown as { find: (id: string | null) => Promise<unknown> }, 'find')
      .mockImplementation(async (id: string | null) => {
        const r = rows.get(id);
        return r ? { source: id ?? 'global', overOrderPct: Number(r.overOrderPct), overReceiptPct: Number(r.overReceiptPct), overBillingPct: Number(r.overBillingPct) } : null;
      });

    expect(await service.resolve('branch')).toMatchObject({ source: 'none', overReceiptPct: 0 });
    rows.set(null, { overOrderPct: '1', overReceiptPct: '2', overBillingPct: '3' });
    expect(await service.resolve('branch')).toMatchObject({ source: 'global', overReceiptPct: 2 });
    rows.set('group', { overOrderPct: '5', overReceiptPct: '5', overBillingPct: '5' });
    rows.set('company', { overOrderPct: '9', overReceiptPct: '9', overBillingPct: '9' });
    expect(await service.resolve('branch')).toMatchObject({ source: 'group', overReceiptPct: 5 });
    rows.set('branch', { overOrderPct: '10', overReceiptPct: '10', overBillingPct: '10' });
    expect(await service.resolve('branch')).toMatchObject({ source: 'branch', overBillingPct: 10 });
    expect(find).toHaveBeenCalled();
  });

  it('3. set() validates only the three percentages (regression: the DTO also carries orgNodeId)', async () => {
    const insert = jest.fn().mockReturnValue({ values: () => ({ onConflictDoUpdate: async () => undefined }) });
    const db = { db: { insert } } as unknown as DatabaseService;
    const org = { getNode: jest.fn().mockResolvedValue({ id: 'n' }) } as unknown as OrganizationService;
    const service = new PurchaseAllowanceService(db, org);
    jest.spyOn(service as unknown as { find: () => Promise<unknown> }, 'find').mockResolvedValue({ source: 'n' });
    const dto = { orgNodeId: 'n', overOrderPct: 10, overReceiptPct: 10, overBillingPct: 10 };
    await expect(service.set('n', dto)).resolves.toMatchObject({ source: 'n' });
    await expect(service.set(null, { ...dto, overBillingPct: 101 })).rejects.toThrow(/between 0 and 100/);
  });
});
