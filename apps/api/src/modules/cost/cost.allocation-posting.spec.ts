import type { AccountingService } from '../accounting/accounting.service';
import type { SalesService } from '../sales/sales.service';
import { CostValidationError } from './cost.errors';
import type { CostRepository } from './cost.repository';
import { CostService } from './cost.service';

/** Overhead allocation posts Dr WIP / Cr applied overhead when the policy names its account. */
describe('Overhead allocation posting', () => {
  const org = 'org-factory';
  const pool = {
    id: 'pool-1',
    name: 'كهرباء الصالة',
    totalAmount: '9000',
    status: 'active',
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-08-31T00:00:00.000Z',
    orgNodeId: org,
  };
  let policy: Record<string, unknown>;
  let repo: Record<string, jest.Mock>;
  let accounting: Record<string, jest.Mock>;
  let service: CostService;

  beforeEach(() => {
    policy = {
      id: 'pol-1',
      code: 'OH-ELEC',
      name: 'بالساعات',
      poolId: pool.id,
      allocationBase: 'machine_hours',
      percentage: '100',
      isActive: 'yes',
      orgNodeId: org,
      appliedAccountId: 'acc-applied-oh',
      journalEntryId: null,
    };
    repo = {
      findPolicyById: jest.fn(async () => policy),
      findPoolById: jest.fn(async () => ({ ...pool })),
      getMachineHours: jest.fn(async () => [
        { workOrderId: 'wo-1', jobOrderReference: 'JO-1', quantity: 20 },
        { workOrderId: 'wo-2', jobOrderReference: 'JO-2', quantity: 10 },
      ]),
      deleteResultsByPolicy: jest.fn(async () => undefined),
      insertAllocationResult: jest.fn(async (r: Record<string, unknown>) => r),
      setPoolStatus: jest.fn(async () => undefined),
      setPolicyJournal: jest.fn(async () => undefined),
    };
    accounting = {
      getCompanyConfig: jest.fn(async () => ({ defaultWipAccountId: 'acc-wip' })),
      findEntryByIdempotencyKey: jest.fn(async () => null),
      createEntry: jest.fn(async (input: Record<string, unknown>) => ({
        id: 'je-oh-1',
        status: 'draft',
        ...input,
      })),
      postEntry: jest.fn(async (id: string) => ({ id, status: 'posted' })),
    };
    service = new CostService(
      repo as unknown as CostRepository,
      {} as SalesService,
      undefined,
      accounting as unknown as AccountingService,
    );
  });

  it('allocates by machine hours and posts the total against WIP', async () => {
    const run = await service.executeAllocation('pol-1');
    expect(run.results.map((r) => r.allocatedAmount)).toEqual(['6000.0000', '3000.0000']);
    expect(run.journalEntryId).toBe('je-oh-1');
    expect(accounting.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: org,
        sourceEventType: 'overhead_allocation',
        lines: [
          expect.objectContaining({ accountId: 'acc-wip', debitAmount: '9000.0000' }),
          expect.objectContaining({ accountId: 'acc-applied-oh', creditAmount: '9000.0000' }),
        ],
      }),
    );
    expect(repo.setPolicyJournal).toHaveBeenCalledWith('pol-1', 'je-oh-1');
  });

  it('refuses before writing anything when the company has no WIP account', async () => {
    accounting.getCompanyConfig!.mockResolvedValue({ defaultWipAccountId: null });
    await expect(service.executeAllocation('pol-1')).rejects.toThrow(CostValidationError);
    expect(repo.insertAllocationResult).not.toHaveBeenCalled();
    expect(repo.setPoolStatus).not.toHaveBeenCalled();
  });

  it('a policy without an applied account allocates without posting (as before)', async () => {
    policy.appliedAccountId = null;
    const run = await service.executeAllocation('pol-1');
    expect(run.journalEntryId).toBeNull();
    expect(accounting.createEntry).not.toHaveBeenCalled();
  });
});
