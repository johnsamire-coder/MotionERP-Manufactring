import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryValidationError } from './inventory.errors';
import type { CatalogService } from '../catalog/catalog.service';
import type {
  BatchBalanceRecord,
  ItemBatchRecord,
  StockMovementRecord,
  StockLedgerEntryRecord,
  WarehouseRecord,
} from './inventory.types';

describe('InventoryService — Per-Batch Costing (plan item 2)', () => {
  let service: InventoryService;
  let repo: InventoryRepository;
  let itemFlags: { hasBatchNo: boolean; hasExpiryDate: boolean; shelfLifeInDays: number | null };

  let balance: { onHand: number; totalValue: number; averageCost: number };
  const batchBalances = new Map<string, BatchBalanceRecord>();
  const batches = new Map<string, ItemBatchRecord>();
  const movements: StockMovementRecord[] = [];
  const ledger: StockLedgerEntryRecord[] = [];

  const makeBatch = (id: string, overrides: Partial<ItemBatchRecord> = {}): ItemBatchRecord => {
    const batch: ItemBatchRecord = {
      id, batchNumber: id.toUpperCase(), itemId: 'item-1', orgNodeId: 'org-1',
      manufacturingDate: null, expiryDate: null, status: 'active', notes: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      ...overrides,
    };
    batches.set(id, batch);
    return batch;
  };

  beforeEach(() => {
    itemFlags = { hasBatchNo: true, hasExpiryDate: false, shelfLifeInDays: null };
    balance = { onHand: 0, totalValue: 0, averageCost: 0 };
    batchBalances.clear();
    batches.clear();
    movements.length = 0;
    ledger.length = 0;

    repo = {
      findWarehouseById: jest.fn().mockResolvedValue({ id: 'wh-1', code: 'WH', name: 'WH', orgNodeId: 'org-1' } as WarehouseRecord),
      findLatestMovementDate: jest.fn().mockResolvedValue(null),
      findBalance: jest.fn().mockImplementation(async () => ({
        id: 'bal-1', itemId: 'item-1', warehouseId: 'wh-1',
        onHand: String(balance.onHand), reserved: '0',
        averageCost: String(balance.averageCost), totalValue: String(balance.totalValue),
      })),
      findBatchById: jest.fn().mockImplementation(async (id: string) => batches.get(id) ?? null),
      findBatchByNumber: jest.fn().mockResolvedValue(null),
      insertBatch: jest.fn().mockImplementation(async (input) => ({ ...input, status: 'active' })),
      findBatchBalance: jest.fn().mockImplementation(async (batchId: string, whId: string) => batchBalances.get(`${batchId}|${whId}`) ?? null),
      upsertBatchBalance: jest.fn().mockImplementation(async (input) => {
        const record = { id: `bb-${input.batchId}`, updatedAt: new Date().toISOString(), ...input } as BatchBalanceRecord;
        batchBalances.set(`${input.batchId}|${input.warehouseId}`, record);
        return record;
      }),
      insertMovement: jest.fn().mockImplementation(async (input) => {
        const record = { ...input, createdAt: new Date().toISOString() } as StockMovementRecord;
        movements.push(record);
        return record;
      }),
      applyDelta: jest.fn().mockImplementation(async (_i, _w, delta: string) => { balance.onHand += Number(delta); }),
      applyValuation: jest.fn().mockImplementation(async (_i, _w, v: { averageCost: string; totalValue: string }) => {
        balance.averageCost = Number(v.averageCost);
        balance.totalValue = Number(v.totalValue);
      }),
      insertLedgerEntry: jest.fn().mockImplementation(async (input) => {
        const record = { ...input, createdAt: new Date().toISOString() } as StockLedgerEntryRecord;
        ledger.push(record);
        return record;
      }),
    } as unknown as InventoryRepository;

    const catalog = {
      getItem: jest.fn().mockImplementation(async (id: string) => ({ id, ...itemFlags, hasSerialNo: false })),
    } as unknown as CatalogService;

    service = new InventoryService(repo, undefined, catalog);
  });

  const receive = (batchId: string | undefined, quantity: string, unitCost: string) =>
    service.createMovement({ itemId: 'item-1', warehouseId: 'wh-1', movementType: 'receipt', quantity, unitCost, batchId });
  const issue = (batchId: string | undefined, quantity: string) =>
    service.createMovement({ itemId: 'item-1', warehouseId: 'wh-1', movementType: 'issue', quantity, batchId });

  it('1. issues each batch at its own cost, not the item average', async () => {
    makeBatch('b-a');
    makeBatch('b-b');
    await receive('b-a', '10', '100');
    await receive('b-b', '10', '200');
    expect(balance.averageCost).toBe(150);

    const out = await issue('b-b', '4');
    expect(out.unitCost).toBe('200.000000');
    expect(out.totalValue).toBe('800.0000');
    expect(out.batchId).toBe('b-b');

    // item value = 1000 + 2000 - 800 = 2200 over 16 units
    expect(balance.onHand).toBe(16);
    expect(balance.totalValue).toBe(2200);
    expect(batchBalances.get('b-b|wh-1')?.quantity).toBe('6.000000');
    expect(batchBalances.get('b-b|wh-1')?.totalValue).toBe('1200.000000');
    expect(ledger.at(-1)?.batchId).toBe('b-b');
  });

  it('2. rejects a movement without batchId for a batch-tracked item (decision b)', async () => {
    await expect(issue(undefined, '1')).rejects.toThrow(/batchId is required/);
    await expect(receive(undefined, '1', '10')).rejects.toThrow(/batchId is required/);
  });

  it('3. rejects batchId for an item that is not batch-tracked', async () => {
    itemFlags.hasBatchNo = false;
    makeBatch('b-a');
    await expect(receive('b-a', '1', '10')).rejects.toThrow(/not batch-tracked/);
  });

  it('4. rejects issuing more than the batch holds', async () => {
    makeBatch('b-a');
    makeBatch('b-b');
    await receive('b-a', '5', '100');
    await receive('b-b', '5', '100');
    await expect(issue('b-a', '6')).rejects.toThrow(/insufficient stock in batch B-A/);
  });

  it('5. rejects issuing an expired, quarantined or foreign batch', async () => {
    makeBatch('b-old', { expiryDate: '2020-01-01T00:00:00.000Z' });
    makeBatch('b-q');
    makeBatch('b-other', { itemId: 'item-2' });
    await receive('b-old', '5', '100');
    await receive('b-q', '5', '100');
    batches.get('b-q')!.status = 'quarantined';

    await expect(issue('b-old', '1')).rejects.toThrow(/expired/);
    await expect(issue('b-q', '1')).rejects.toThrow(/"quarantined"/);
    await expect(issue('b-other', '1')).rejects.toThrow(InventoryValidationError);
  });

  it('6. issuing a whole batch removes its exact value', async () => {
    makeBatch('b-a');
    await receive('b-a', '3', '10');
    await receive('b-a', '3', '10.01');
    const out = await issue('b-a', '6');
    expect(out.totalValue).toBe('60.0300');
    expect(balance.onHand).toBe(0);
    expect(balance.totalValue).toBe(0);
    expect(batchBalances.get('b-a|wh-1')?.totalValue).toBe('0.000000');
  });

  it('7. createBatch derives expiry from shelf life and requires it for expiry-tracked items', async () => {
    itemFlags.hasExpiryDate = true;
    await expect(
      service.createBatch({ batchNumber: 'X1', itemId: 'item-1', orgNodeId: 'org-1' }),
    ).rejects.toThrow(/expiryDate is required/);

    itemFlags.shelfLifeInDays = 30;
    const batch = await service.createBatch({
      batchNumber: 'X2', itemId: 'item-1', orgNodeId: 'org-1', manufacturingDate: '2026-01-01T00:00:00.000Z',
    });
    expect(batch.expiryDate).toBe('2026-01-31T00:00:00.000Z');
  });
});
