import type { InventoryRepository } from './inventory.repository';
import type { InventoryService } from './inventory.service';
import type { WarehouseRecord } from './inventory.types';
import { buildWarehouseTree, WarehouseTreeService } from './warehouse-tree.service';

describe('Tree warehouses (plan item 23)', () => {
  let whs: WarehouseRecord[];
  let history: Set<string>;
  let service: WarehouseTreeService;
  const wh = (id: string, isGroup = false, parentWarehouseId: string | null = null): WarehouseRecord =>
    ({ id, code: id.toUpperCase(), name: id, orgNodeId: 'o', isGroup, parentWarehouseId } as WarehouseRecord);

  beforeEach(() => {
    whs = [wh('all', true), wh('cairo', true, 'all'), wh('c1', false, 'cairo'), wh('c2', false, 'cairo'), wh('alx', false, 'all'), wh('loose')];
    history = new Set(['c1', 'loose']);
    const repo = {
      listWarehouses: jest.fn().mockImplementation(async () => whs),
      findWarehouseById: jest.fn().mockImplementation(async (id: string) => whs.find((w) => w.id === id) ?? null),
      setWarehouseTree: jest.fn().mockImplementation(async (id: string, f: Partial<WarehouseRecord>) => { Object.assign(whs.find((w) => w.id === id)!, f); }),
      warehouseHasStockHistory: jest.fn().mockImplementation(async (id: string) => history.has(id)),
    } as unknown as InventoryRepository;
    service = new WarehouseTreeService(repo, {} as InventoryService);
  });

  it('1. rolls stock and value up to every ancestor', () => {
    const tree = buildWarehouseTree(whs, [
      { warehouseId: 'c1', onHand: '10', totalValue: '100' },
      { warehouseId: 'c1', onHand: '5', totalValue: '20' },
      { warehouseId: 'c2', onHand: '3', totalValue: '30' },
      { warehouseId: 'alx', onHand: '2', totalValue: '8' },
    ]);
    const all = tree.find((n) => n.id === 'all')!;
    expect(all).toMatchObject({ ownOnHand: '0.000000', totalOnHand: '20.000000', totalValue: '158.0000' });
    expect(all.children.find((c) => c.id === 'cairo')).toMatchObject({ totalOnHand: '18.000000', totalValue: '150.0000' });
    expect(tree.map((n) => n.id).sort()).toEqual(['all', 'loose']);
  });

  it('2. a warehouse whose parent is hidden shows as a root', () => {
    const tree = buildWarehouseTree(whs.filter((w) => w.id !== 'all'), []);
    expect(tree.map((n) => n.id).sort()).toEqual(['alx', 'cairo', 'loose']);
  });

  it('3. the parent must be a group and cycles are refused', async () => {
    await expect(service.setParent('loose', 'alx')).rejects.toThrow(/مش مجموعة/);
    await expect(service.setParent('all', 'cairo')).rejects.toThrow(/حلقة/);
    await expect(service.setParent('all', 'all')).rejects.toThrow(/own parent/);
    expect((await service.setParent('loose', 'cairo')).parentWarehouseId).toBe('cairo');
    expect((await service.setParent('loose', null)).parentWarehouseId).toBeNull();
  });

  it('4. only an unused warehouse becomes a group; a group with children stays a group', async () => {
    await expect(service.setGroup('c1', true)).rejects.toThrow(/رصيد أو حركات/);
    expect((await service.setGroup('alx', true)).isGroup).toBe(true);
    await expect(service.setGroup('cairo', false)).rejects.toThrow(/C1، C2/);
    expect((await service.setGroup('alx', false)).isGroup).toBe(false);
  });
});
