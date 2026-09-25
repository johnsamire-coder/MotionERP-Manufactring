import type { DatabaseService } from '../../core/database/database.service';
import type { HrRepository } from './hr.repository';
import { LeaveService } from './leave.service';

describe('Bulk leave allocation validation (plan item 20)', () => {
  const chain = (rows: unknown[]): unknown => ({
    from: () => ({ where: () => ({ limit: async () => rows }) }),
  });
  const service = (type: unknown | null, employees: unknown[] = []): LeaveService =>
    new LeaveService(
      { db: { select: () => chain(type ? [type] : []) } } as unknown as DatabaseService,
      { listEmployees: jest.fn().mockResolvedValue(employees) } as unknown as HrRepository,
    );
  const base = { leaveTypeId: 't', fromDate: '2026-01-01', toDate: '2026-12-31', days: '10' };

  it('rejects an unknown type, a reversed period, non-positive days, days above the maximum, and no match', async () => {
    await expect(service(null).bulkAllocate(base)).rejects.toThrow(/does not exist/);
    const annual = { id: 't', code: 'ANNUAL', maxDaysPerAllocation: '21' };
    await expect(service(annual).bulkAllocate({ ...base, toDate: '2025-01-01' })).rejects.toThrow(
      /invalid period/,
    );
    await expect(service(annual).bulkAllocate({ ...base, days: '0' })).rejects.toThrow(
      /days must be positive/,
    );
    await expect(service(annual).bulkAllocate({ ...base, days: '22' })).rejects.toThrow(
      /at most 21 days/,
    );
    const onlyTerminated = [
      { id: 'e', code: 'E', status: 'terminated', role: 'x', orgNodeId: 'o' },
    ];
    await expect(service(annual, onlyTerminated).bulkAllocate(base)).rejects.toThrow(
      /no active employee/,
    );
  });
});
