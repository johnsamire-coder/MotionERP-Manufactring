import { AuthNotFoundError, AuthValidationError } from './auth.errors';
import type { AuthRepository } from './auth.repository';
import type { UserPermissionRecord } from './auth.types';
import { UserPermissionService } from './user-permission.service';

describe('UserPermissionService (plan item 5.1)', () => {
  let rows: UserPermissionRecord[];
  let service: UserPermissionService;

  beforeEach(() => {
    rows = [];
    const repo = {
      findUserById: jest
        .fn()
        .mockImplementation(async (id: string) => (id === 'u-1' ? { id } : null)),
      orgNodeExists: jest.fn().mockImplementation(async (id: string) => id.startsWith('org-')),
      warehouseExists: jest.fn().mockImplementation(async (id: string) => id.startsWith('wh-')),
      findUserPermission: jest
        .fn()
        .mockImplementation(
          async (u: string, t: string, v: string) =>
            rows.find((r) => r.userId === u && r.allowType === t && r.allowValue === v) ?? null,
        ),
      insertUserPermission: jest.fn().mockImplementation(async (input) => {
        const record = { ...input, createdAt: new Date().toISOString() } as UserPermissionRecord;
        rows.push(record);
        return record;
      }),
      listUserPermissions: jest
        .fn()
        .mockImplementation(async (u?: string) => rows.filter((r) => !u || r.userId === u)),
      findUserPermissionById: jest
        .fn()
        .mockImplementation(async (id: string) => rows.find((r) => r.id === id) ?? null),
      deleteUserPermission: jest.fn().mockImplementation(async (id: string) => {
        rows = rows.filter((r) => r.id !== id);
      }),
    } as unknown as AuthRepository;
    service = new UserPermissionService(repo);
  });

  it('1. adds a warehouse and an org node restriction', async () => {
    await service.add({ userId: 'u-1', allowType: 'warehouse', allowValue: 'wh-cairo' });
    await service.add({ userId: 'u-1', allowType: 'org_node', allowValue: 'org-branch-1' });
    expect(rows).toHaveLength(2);
  });

  it('2. rejects unknown user, unknown value, bad type and duplicates', async () => {
    await expect(
      service.add({ userId: 'u-x', allowType: 'warehouse', allowValue: 'wh-1' }),
    ).rejects.toThrow(AuthNotFoundError);
    await expect(
      service.add({ userId: 'u-1', allowType: 'warehouse', allowValue: 'nope' }),
    ).rejects.toThrow(/warehouse nope does not exist/);
    await expect(
      service.add({ userId: 'u-1', allowType: 'org_node', allowValue: 'nope' }),
    ).rejects.toThrow(/org node nope does not exist/);
    await expect(
      service.add({ userId: 'u-1', allowType: 'company' as never, allowValue: 'org-1' }),
    ).rejects.toThrow(AuthValidationError);
    await service.add({ userId: 'u-1', allowType: 'warehouse', allowValue: 'wh-1' });
    await expect(
      service.add({ userId: 'u-1', allowType: 'warehouse', allowValue: 'wh-1' }),
    ).rejects.toThrow(/already exists/);
  });

  it('3. getRestrictions: null means unrestricted on that dimension', async () => {
    expect(await service.getRestrictions('u-1')).toEqual({ orgNodeIds: null, warehouseIds: null });
    await service.add({ userId: 'u-1', allowType: 'warehouse', allowValue: 'wh-1' });
    await service.add({ userId: 'u-1', allowType: 'warehouse', allowValue: 'wh-2' });
    expect(await service.getRestrictions('u-1')).toEqual({
      orgNodeIds: null,
      warehouseIds: ['wh-1', 'wh-2'],
    });
  });

  it('4. removes a restriction and rejects an unknown id', async () => {
    const r = await service.add({ userId: 'u-1', allowType: 'warehouse', allowValue: 'wh-1' });
    await service.remove(r.id);
    expect(rows).toHaveLength(0);
    await expect(service.remove(r.id)).rejects.toThrow(AuthNotFoundError);
  });
});
