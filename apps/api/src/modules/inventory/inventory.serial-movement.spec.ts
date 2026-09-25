import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryNotFoundError } from './inventory.errors';
import type { CatalogService } from '../catalog/catalog.service';
import type { SerialNumberRecord, StockMovementRecord, WarehouseRecord } from './inventory.types';

describe('InventoryService — Serial Numbers on Stock Movements (plan item 2b)', () => {
  let service: InventoryService;
  let repo: InventoryRepository;
  let hasSerialNo: boolean;
  let onHand: number;
  const serials = new Map<string, SerialNumberRecord>();
  const links: Array<{ movementId: string; serialIds: string[] }> = [];

  beforeEach(() => {
    hasSerialNo = true;
    onHand = 0;
    serials.clear();
    links.length = 0;

    repo = {
      findWarehouseById: jest
        .fn()
        .mockImplementation(
          async (id: string) => ({ id, code: id, name: id, orgNodeId: 'org-1' }) as WarehouseRecord,
        ),
      findLatestMovementDate: jest.fn().mockResolvedValue(null),
      findBalance: jest.fn().mockImplementation(async () => ({
        id: 'bal-1',
        onHand: String(onHand),
        reserved: '0',
        averageCost: '10',
        totalValue: String(onHand * 10),
      })),
      insertMovement: jest
        .fn()
        .mockImplementation(
          async (input) =>
            ({ ...input, createdAt: new Date().toISOString() }) as StockMovementRecord,
        ),
      applyDelta: jest.fn().mockImplementation(async (_i, _w, delta: string) => {
        onHand += Number(delta);
      }),
      applyValuation: jest.fn().mockResolvedValue(undefined),
      insertLedgerEntry: jest.fn().mockResolvedValue({}),
      findSerialByNo: jest
        .fn()
        .mockImplementation(
          async (_itemId: string, no: string) =>
            [...serials.values()].find((s) => s.serialNo === no) ?? null,
        ),
      insertSerial: jest.fn().mockImplementation(async (input) => {
        const record = {
          ...input,
          status: 'active',
          batchId: input.batchId ?? null,
        } as SerialNumberRecord;
        serials.set(record.id, record);
        return record;
      }),
      moveSerial: jest.fn().mockImplementation(async (id: string, changes) => {
        const s = serials.get(id)!;
        s.status = changes.status;
        s.warehouseId = changes.warehouseId;
        if (changes.batchId !== undefined) s.batchId = changes.batchId;
      }),
      insertMovementSerials: jest
        .fn()
        .mockImplementation(async (movementId: string, serialIds: string[]) => {
          links.push({ movementId, serialIds });
        }),
    } as unknown as InventoryRepository;

    const catalog = {
      getItem: jest.fn().mockImplementation(async (id: string) => ({
        id,
        hasBatchNo: false,
        hasSerialNo,
        hasExpiryDate: false,
        shelfLifeInDays: null,
      })),
    } as unknown as CatalogService;

    service = new InventoryService(repo, undefined, catalog);
  });

  const move = (
    movementType: 'receipt' | 'issue' | 'transfer_out' | 'transfer_in',
    warehouseId: string,
    serialNos?: string[],
    quantity?: string,
  ) =>
    service.createMovement({
      itemId: 'item-1',
      warehouseId,
      movementType,
      quantity: quantity ?? String(serialNos?.length ?? 1),
      unitCost: movementType === 'receipt' || movementType === 'transfer_in' ? '10' : undefined,
      serialNos,
    });

  const byNo = (no: string) => [...serials.values()].find((s) => s.serialNo === no);

  it('1. receipt creates the serials in the warehouse and links them to the movement', async () => {
    const m = await move('receipt', 'wh-1', ['SN-1', 'SN-2']);
    expect(m.serialNos).toEqual(['SN-1', 'SN-2']);
    expect(byNo('SN-1')).toMatchObject({ status: 'active', warehouseId: 'wh-1' });
    expect(links[0]?.serialIds.length).toBe(2);
  });

  it('2. requires exactly one serial per unit, whole quantities and no duplicates', async () => {
    await expect(move('receipt', 'wh-1', ['SN-1'], '2')).rejects.toThrow(
      /2 serial numbers required, got 1/,
    );
    await expect(move('receipt', 'wh-1', undefined, '1')).rejects.toThrow(
      /1 serial numbers required, got 0/,
    );
    await expect(move('receipt', 'wh-1', ['SN-1', 'SN-1'])).rejects.toThrow(
      /listed more than once/,
    );
    await expect(move('receipt', 'wh-1', ['SN-1'], '1.5')).rejects.toThrow(/whole number/);
  });

  it('3. rejects receiving a serial that is already in stock', async () => {
    await move('receipt', 'wh-1', ['SN-1']);
    await expect(move('receipt', 'wh-2', ['SN-1'])).rejects.toThrow(/already in stock/);
  });

  it('4. issue marks the serial delivered; it cannot be issued again', async () => {
    await move('receipt', 'wh-1', ['SN-1', 'SN-2']);
    await move('issue', 'wh-1', ['SN-2']);
    expect(byNo('SN-2')).toMatchObject({ status: 'delivered', warehouseId: null });
    await expect(move('issue', 'wh-1', ['SN-2'])).rejects.toThrow(/not in stock in this warehouse/);
  });

  it('5. rejects issuing an unknown serial or one held in another warehouse', async () => {
    await move('receipt', 'wh-1', ['SN-1']);
    await expect(move('issue', 'wh-1', ['SN-X'])).rejects.toThrow(InventoryNotFoundError);
    await expect(move('issue', 'wh-2', ['SN-1'])).rejects.toThrow(/not in stock in this warehouse/);
  });

  it('6. transfer out/in moves the serial between warehouses', async () => {
    await move('receipt', 'wh-1', ['SN-1']);
    await move('transfer_out', 'wh-1', ['SN-1']);
    expect(byNo('SN-1')).toMatchObject({ status: 'active', warehouseId: null });
    await move('transfer_in', 'wh-2', ['SN-1']);
    expect(byNo('SN-1')).toMatchObject({ status: 'active', warehouseId: 'wh-2' });
  });

  it('7. rejects serialNos for an item that is not serial-tracked', async () => {
    hasSerialNo = false;
    await expect(move('receipt', 'wh-1', ['SN-1'])).rejects.toThrow(/not serial-tracked/);
  });
});
