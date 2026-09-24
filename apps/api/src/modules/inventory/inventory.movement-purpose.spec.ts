import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import type { StockMovementRecord, WarehouseRecord } from './inventory.types';

describe('InventoryService — Movement Purpose & Transfers for Manufacture (plan item 3)', () => {
  let service: InventoryService;
  let repo: InventoryRepository;
  const onHand = new Map<string, number>();
  const movements: StockMovementRecord[] = [];

  beforeEach(() => {
    onHand.clear();
    onHand.set('wh-store', 10);
    movements.length = 0;

    repo = {
      findWarehouseById: jest
        .fn()
        .mockImplementation(async (id: string) =>
          id === 'wh-missing'
            ? null
            : ({ id, code: id, name: id, orgNodeId: 'org-1' } as WarehouseRecord),
        ),
      findLatestMovementDate: jest.fn().mockResolvedValue(null),
      findBalance: jest.fn().mockImplementation(async (_itemId: string, whId: string) => {
        const qty = onHand.get(whId) ?? 0;
        return {
          id: `bal-${whId}`,
          onHand: String(qty),
          reserved: '0',
          averageCost: '25',
          totalValue: String(qty * 25),
        };
      }),
      insertMovement: jest.fn().mockImplementation(async (input) => {
        const record = {
          ...input,
          purpose: input.purpose ?? 'general',
          createdAt: new Date().toISOString(),
        } as StockMovementRecord;
        movements.push(record);
        return record;
      }),
      applyDelta: jest.fn().mockImplementation(async (_i, whId: string, delta: string) => {
        onHand.set(whId, (onHand.get(whId) ?? 0) + Number(delta));
      }),
      applyValuation: jest.fn().mockResolvedValue(undefined),
      insertLedgerEntry: jest.fn().mockResolvedValue({}),
    } as unknown as InventoryRepository;

    service = new InventoryService(repo);
  });

  it('1. defaults purpose to general', async () => {
    const m = await service.createMovement({
      itemId: 'item-1',
      warehouseId: 'wh-store',
      movementType: 'issue',
      quantity: '1',
    });
    expect(m.purpose).toBe('general');
  });

  it('2. manufacture_consumption is only allowed on an issue', async () => {
    const m = await service.createMovement({
      itemId: 'item-1',
      warehouseId: 'wh-store',
      movementType: 'issue',
      quantity: '2',
      purpose: 'manufacture_consumption',
    });
    expect(m.purpose).toBe('manufacture_consumption');
    await expect(
      service.createMovement({
        itemId: 'item-1',
        warehouseId: 'wh-store',
        movementType: 'receipt',
        quantity: '2',
        unitCost: '1',
        purpose: 'manufacture_consumption',
      }),
    ).rejects.toThrow(/only allows movement types: issue/);
  });

  it('3. material_transfer_for_manufacture is only allowed on transfers', async () => {
    await expect(
      service.createMovement({
        itemId: 'item-1',
        warehouseId: 'wh-store',
        movementType: 'issue',
        quantity: '1',
        purpose: 'material_transfer_for_manufacture',
      }),
    ).rejects.toThrow(/only allows movement types: transfer_out, transfer_in/);
  });

  it('4. transferStock moves stock at source cost as an out/in pair with the same purpose and date', async () => {
    const { transferOut, transferIn } = await service.transferStock({
      itemId: 'item-1',
      fromWarehouseId: 'wh-store',
      toWarehouseId: 'wh-wip',
      quantity: '4',
      purpose: 'material_transfer_for_manufacture',
      movementDate: '2026-09-23T08:00:00.000Z',
    });
    expect(transferOut.movementType).toBe('transfer_out');
    expect(transferIn.movementType).toBe('transfer_in');
    expect(transferIn.unitCost).toBe('25.000000');
    expect(transferOut.purpose).toBe('material_transfer_for_manufacture');
    expect(transferIn.purpose).toBe('material_transfer_for_manufacture');
    expect(transferIn.movementDate).toBe(transferOut.movementDate);
    expect(onHand.get('wh-store')).toBe(6);
    expect(onHand.get('wh-wip')).toBe(4);
  });

  it('5. transferStock rejects same warehouse, consumption purpose, unknown target and backdated target', async () => {
    const base = { itemId: 'item-1', fromWarehouseId: 'wh-store', quantity: '1' };
    await expect(service.transferStock({ ...base, toWarehouseId: 'wh-store' })).rejects.toThrow(
      /must be different/,
    );
    await expect(
      service.transferStock({
        ...base,
        toWarehouseId: 'wh-wip',
        purpose: 'manufacture_consumption',
      }),
    ).rejects.toThrow(/not a transfer/);
    await expect(service.transferStock({ ...base, toWarehouseId: 'wh-missing' })).rejects.toThrow(
      /does not exist/,
    );

    (repo.findLatestMovementDate as jest.Mock).mockImplementation(
      async (_i: string, whId: string) =>
        whId === 'wh-wip' ? new Date('2026-12-31T00:00:00.000Z') : null,
    );
    await expect(
      service.transferStock({
        ...base,
        toWarehouseId: 'wh-wip',
        movementDate: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/target warehouse/);
    expect(movements.length).toBe(0);
    expect(onHand.get('wh-store')).toBe(10);
  });
});
