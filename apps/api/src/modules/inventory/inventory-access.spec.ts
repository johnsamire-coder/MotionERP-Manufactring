import { requestContext } from '../../core/request-context/request-context';
import type { UserPermissionService } from '../auth/user-permission.service';
import type { OrganizationService } from '../organization/organization.service';
import type { OrgTreeNode } from '../organization/organization.types';
import { InventoryAccessService } from './inventory-access.service';
import { InventoryForbiddenError } from './inventory.errors';
import type { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import type { StockMovementRecord, WarehouseRecord } from './inventory.types';

// Company CO → branches CAI (Cairo) and ALX (Alexandria); each has one warehouse; one warehouse sits on CO itself.
const node = (id: string, children: OrgTreeNode[] = []): OrgTreeNode =>
  ({ id, nodeType: 'branch', name: id, parentId: null, status: 'active', position: 0, createdAt: '', updatedAt: '', children });
const tree = [node('CO', [node('CAI'), node('ALX')])];
const warehouses = [
  { id: 'wh-cai', code: 'CAI', name: 'Cairo', orgNodeId: 'CAI' },
  { id: 'wh-alx', code: 'ALX', name: 'Alex', orgNodeId: 'ALX' },
  { id: 'wh-hq', code: 'HQ', name: 'HQ', orgNodeId: 'CO' },
] as WarehouseRecord[];

describe('Inventory user restrictions (plan item 5.2)', () => {
  let restrictions: { orgNodeIds: string[] | null; warehouseIds: string[] | null };
  let access: InventoryAccessService;
  let service: InventoryService;
  const movements: StockMovementRecord[] = [];

  const asUser = <T>(fn: () => Promise<T>, userId: string | undefined = 'u-1'): Promise<T> =>
    requestContext.run({ userId }, fn);

  beforeEach(() => {
    restrictions = { orgNodeIds: null, warehouseIds: null };
    movements.length = 0;
    const perms = { getRestrictions: jest.fn().mockImplementation(async () => restrictions) } as unknown as UserPermissionService;
    const org = { getTree: jest.fn().mockResolvedValue(tree) } as unknown as OrganizationService;
    const repo = {
      listWarehouses: jest.fn().mockResolvedValue(warehouses),
      findWarehouseById: jest.fn().mockImplementation(async (id: string) => warehouses.find((w) => w.id === id) ?? null),
      findWarehouseByCode: jest.fn().mockResolvedValue(null),
      insertWarehouse: jest.fn().mockImplementation(async (input) => input),
      findLatestMovementDate: jest.fn().mockResolvedValue(null),
      findBalance: jest.fn().mockResolvedValue({ onHand: '100', reserved: '0', averageCost: '1', totalValue: '100' }),
      insertMovement: jest.fn().mockImplementation(async (input) => { movements.push(input); return input; }),
      applyDelta: jest.fn(), applyValuation: jest.fn(), insertLedgerEntry: jest.fn(),
      listMovements: jest.fn().mockImplementation(async () => [
        { id: 'm1', warehouseId: 'wh-cai' }, { id: 'm2', warehouseId: 'wh-alx' }, { id: 'm3', warehouseId: 'wh-hq' },
      ]),
    } as unknown as InventoryRepository;
    access = new InventoryAccessService(perms, org, repo);
    service = new InventoryService(repo, undefined, undefined, access);
  });

  const ids = (rows: { id: string }[]): string[] => rows.map((r) => r.id).sort();

  it('1. anonymous or unrestricted users see every warehouse', async () => {
    expect(ids(await asUser(() => service.getWarehouses(), undefined))).toEqual(['wh-alx', 'wh-cai', 'wh-hq']);
    expect(ids(await asUser(() => service.getWarehouses()))).toEqual(['wh-alx', 'wh-cai', 'wh-hq']);
  });

  it('2. a warehouse restriction limits lists and movements to that warehouse', async () => {
    restrictions.warehouseIds = ['wh-cai'];
    expect(ids(await asUser(() => service.getWarehouses()))).toEqual(['wh-cai']);
    expect(ids(await asUser(() => service.getMovements()))).toEqual(['m1']);
    await expect(asUser(() => service.createMovement({ itemId: 'i', warehouseId: 'wh-alx', movementType: 'issue', quantity: '1' })))
      .rejects.toThrow(InventoryForbiddenError);
    await asUser(() => service.createMovement({ itemId: 'i', warehouseId: 'wh-cai', movementType: 'issue', quantity: '1' }));
    expect(movements).toHaveLength(1);
  });

  it('3. an org node restriction covers warehouses in its whole subtree', async () => {
    restrictions.orgNodeIds = ['CO'];
    expect(ids(await asUser(() => service.getWarehouses()))).toEqual(['wh-alx', 'wh-cai', 'wh-hq']);
    restrictions.orgNodeIds = ['ALX'];
    expect(ids(await asUser(() => service.getWarehouses()))).toEqual(['wh-alx']);
  });

  it('4. org node and warehouse restrictions combine (both must match)', async () => {
    restrictions.orgNodeIds = ['CAI'];
    restrictions.warehouseIds = ['wh-cai', 'wh-alx'];
    expect(ids(await asUser(() => service.getWarehouses()))).toEqual(['wh-cai']);
  });

  it('5. transfers need both ends allowed and nothing moves otherwise', async () => {
    restrictions.warehouseIds = ['wh-cai'];
    await expect(asUser(() => service.transferStock({ itemId: 'i', fromWarehouseId: 'wh-cai', toWarehouseId: 'wh-alx', quantity: '1' })))
      .rejects.toThrow(InventoryForbiddenError);
    expect(movements).toHaveLength(0);
  });

  it('6. creating a warehouse: only inside allowed org nodes; warehouse-restricted users cannot', async () => {
    restrictions.orgNodeIds = ['CAI'];
    await asUser(() => service.createWarehouse({ code: 'CAI-2', name: 'Cairo 2', orgNodeId: 'CAI' }));
    await expect(asUser(() => service.createWarehouse({ code: 'ALX-2', name: 'Alex 2', orgNodeId: 'ALX' })))
      .rejects.toThrow(InventoryForbiddenError);
    restrictions = { orgNodeIds: null, warehouseIds: ['wh-cai'] };
    await expect(asUser(() => service.createWarehouse({ code: 'X', name: 'X', orgNodeId: 'CAI' })))
      .rejects.toThrow(/لا يمكنه إنشاء مخازن/);
  });
});
