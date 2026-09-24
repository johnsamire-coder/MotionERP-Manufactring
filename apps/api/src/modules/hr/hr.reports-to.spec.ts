import type { HrRepository } from './hr.repository';
import { HrService } from './hr.service';
import type { EmployeeRecord, EmployeeStatus } from './hr.types';

describe('Manager hierarchy and leaving (plan item 10)', () => {
  let employees: Map<string, EmployeeRecord>;
  let service: HrService;

  const emp = (
    id: string,
    name: string,
    reportsTo: string | null = null,
    status: EmployeeStatus = 'active',
  ): EmployeeRecord => ({
    id,
    code: id.toUpperCase(),
    name,
    role: 'x',
    orgNodeId: 'o',
    baseSalary: '0',
    status,
    reportsTo,
    relievingDate: null,
  });

  beforeEach(() => {
    employees = new Map([
      ['boss', emp('boss', 'أحمد المدير')],
      ['sara', emp('sara', 'سارة', 'boss')],
      ['omar', emp('omar', 'عمر', 'boss')],
      ['old', emp('old', 'قديم', 'boss', 'terminated')],
      ['lone', emp('lone', 'منفرد')],
    ]);
    const repo = {
      findEmployeeById: jest
        .fn()
        .mockImplementation(async (id: string) => employees.get(id) ?? null),
      setEmployeeReportsTo: jest.fn().mockImplementation(async (id: string, m: string | null) => {
        employees.get(id)!.reportsTo = m;
        return employees.get(id);
      }),
      listActiveSubordinates: jest
        .fn()
        .mockImplementation(async (id: string) =>
          [...employees.values()].filter((e) => e.reportsTo === id && e.status === 'active'),
        ),
      setEmployeeStatus: jest
        .fn()
        .mockImplementation(async (id: string, status: EmployeeStatus, d: Date) => {
          Object.assign(employees.get(id)!, { status, relievingDate: d.toISOString() });
          return employees.get(id);
        }),
    } as unknown as HrRepository;
    service = new HrService(repo);
  });

  it('1. refuses to terminate a manager with active subordinates and names each of them', async () => {
    await expect(service.terminateEmployee('boss')).rejects.toThrow(
      /2 موظف نشط تابع له — SARA \(سارة\)، OMAR \(عمر\)/,
    );
    expect(employees.get('boss')!.status).toBe('active');
  });

  it('2. terminated subordinates do not block; once reassigned the manager can leave', async () => {
    await service.setReportsTo('sara', 'lone');
    await service.setReportsTo('omar', null);
    const left = await service.terminateEmployee('boss', '2026-09-30');
    expect(left).toMatchObject({ status: 'terminated', relievingDate: '2026-09-30T00:00:00.000Z' });
  });

  it('3. rejects self-management, loops, inactive managers and double termination', async () => {
    await expect(service.setReportsTo('boss', 'boss')).rejects.toThrow(/themself/);
    await expect(service.setReportsTo('boss', 'sara')).rejects.toThrow(/loop/);
    await expect(service.setReportsTo('lone', 'old')).rejects.toThrow(/not active/);
    await service.terminateEmployee('lone');
    await expect(service.terminateEmployee('lone')).rejects.toThrow(/already terminated/);
  });

  it('4. (plan item 11) terminating disables the linked login(s) and reports them', async () => {
    const auth = { deactivateUsersForEmployee: jest.fn().mockResolvedValue(['lone.user']) };
    const withAuth = new HrService(
      (service as unknown as { repository: HrRepository }).repository,
      auth as never,
    );
    const res = await withAuth.terminateEmployee('lone');
    expect(auth.deactivateUsersForEmployee).toHaveBeenCalledWith(['LONE', 'lone']);
    expect(res.deactivatedUsers).toEqual(['lone.user']);
  });
});
