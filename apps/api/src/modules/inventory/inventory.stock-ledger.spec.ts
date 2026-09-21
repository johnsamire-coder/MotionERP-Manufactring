import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryValidationError } from './inventory.errors';
import type {
  WarehouseRecord,
  StockMovementRecord,
  StockLedgerEntryRecord,
} from './inventory.types';

describe('InventoryService — Moving Weighted Average & Stock Ledger', () => {
  let service: InventoryService;
  let repo: InventoryRepository;

  // Mock In-Memory State
  let mockBalance: { onHand: string; reserved: string; averageCost: string; totalValue: string; lastPurchaseCost: string | null } | null = null;
  const mockMovements: StockMovementRecord[] = [];
  const mockLedger: StockLedgerEntryRecord[] = [];

  beforeEach(() => {
    mockBalance = null;
    mockMovements.length = 0;
    mockLedger.length = 0;

    repo = {
      findWarehouseById: jest.fn().mockResolvedValue({ id: 'wh-1', code: 'WH-MAIN', name: 'Main Warehouse' } as WarehouseRecord),
      findBalance: jest.fn().mockImplementation(async () => {
        if (!mockBalance) return null;
        return {
          id: 'bal-1',
          itemId: 'item-1',
          warehouseId: 'wh-1',
          ...mockBalance,
          updatedAt: new Date(),
          lastPurchaseAt: null,
        } as any;
      }),
      insertMovement: jest.fn().mockImplementation(async (input) => {
        const record = { ...input, createdAt: new Date().toISOString() };
        mockMovements.push(record);
        return record;
      }),
      applyDelta: jest.fn().mockImplementation(async (_itemId, _whId, delta) => {
        const deltaNum = Number(delta);
        if (!mockBalance) {
          mockBalance = { onHand: delta, reserved: '0', averageCost: '0', totalValue: '0', lastPurchaseCost: null };
        } else {
          mockBalance.onHand = (Number(mockBalance.onHand) + deltaNum).toString();
        }
      }),
      applyValuation: jest.fn().mockImplementation(async (_itemId, _whId, v) => {
        if (mockBalance) {
          mockBalance.averageCost = v.averageCost;
          mockBalance.totalValue = v.totalValue;
          if (v.lastPurchaseCost) mockBalance.lastPurchaseCost = v.lastPurchaseCost;
        }
      }),
      insertLedgerEntry: jest.fn().mockImplementation(async (input) => {
        const record = { ...input, createdAt: new Date().toISOString() };
        mockLedger.push(record);
        return record;
      }),
      listLedgerEntries: jest.fn().mockImplementation(async () => mockLedger),
    } as unknown as InventoryRepository;

    service = new InventoryService(repo);
  });

  it('1. First Receipt: should initialize moving average and record stock ledger entry', async () => {
    const movement = await service.createMovement({
      itemId: 'item-1',
      warehouseId: 'wh-1',
      movementType: 'receipt',
      quantity: '10',
      unitCost: '100',
    });

    expect(movement.unitCost).toBe('100.000000');
    expect(movement.totalValue).toBe('1000.0000');
    expect(repo.applyValuation).toHaveBeenCalledWith('item-1', 'wh-1', {
      averageCost: '100.000000',
      totalValue: '1000.0000',
      lastPurchaseCost: '100.000000',
    });

    expect(mockLedger.length).toBe(1);
    expect(mockLedger[0]?.balanceQtyAfter).toBe('10.000000');
    expect(mockLedger[0]?.valuationRate).toBe('100.000000');
    expect(mockLedger[0]?.stockValueAfter).toBe('1000.0000');
  });

  it('2. Second Receipt: should correctly calculate weighted moving average [(10*100 + 10*200) / 20 = 150]', async () => {
    // 1st receipt @ 100 EGP
    await service.createMovement({
      itemId: 'item-1',
      warehouseId: 'wh-1',
      movementType: 'receipt',
      quantity: '10',
      unitCost: '100',
    });

    // 2nd receipt @ 200 EGP
    await service.createMovement({
      itemId: 'item-1',
      warehouseId: 'wh-1',
      movementType: 'receipt',
      quantity: '10',
      unitCost: '200',
    });

    expect(repo.applyValuation).toHaveBeenLastCalledWith('item-1', 'wh-1', {
      averageCost: '150.000000',
      totalValue: '3000.0000',
      lastPurchaseCost: '200.000000',
    });

    expect(mockLedger.length).toBe(2);
    expect(mockLedger[1]?.balanceQtyAfter).toBe('20.000000');
    expect(mockLedger[1]?.valuationRate).toBe('150.000000');
    expect(mockLedger[1]?.stockValueAfter).toBe('3000.0000');
  });

  it('3. Issue: should issue at current moving average (150 EGP) without changing the unit average cost', async () => {
    mockBalance = {
      onHand: '20',
      reserved: '0',
      averageCost: '150.000000',
      totalValue: '3000.0000',
      lastPurchaseCost: '200.000000',
    };

    const movement = await service.createMovement({
      itemId: 'item-1',
      warehouseId: 'wh-1',
      movementType: 'issue',
      quantity: '5',
    });

    expect(movement.unitCost).toBe('150.000000');
    expect(movement.totalValue).toBe('750.0000');
    expect(repo.applyValuation).toHaveBeenCalledWith('item-1', 'wh-1', {
      averageCost: '150.000000',
      totalValue: '2250.0000',
      lastPurchaseCost: undefined,
    });

    expect(mockLedger.length).toBe(1);
    expect(mockLedger[0]?.quantityChange).toBe('-5');
    expect(mockLedger[0]?.balanceQtyAfter).toBe('15.000000');
    expect(mockLedger[0]?.valuationRate).toBe('150.000000');
    expect(mockLedger[0]?.stockValueChange).toBe('-750.0000');
    expect(mockLedger[0]?.stockValueAfter).toBe('2250.0000');
  });

  it('4. Insufficient Stock: should throw InventoryValidationError and not modify ledger', async () => {
    mockBalance = {
      onHand: '5',
      reserved: '0',
      averageCost: '100.000000',
      totalValue: '500.0000',
      lastPurchaseCost: '100.000000',
    };

    await expect(
      service.createMovement({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        movementType: 'issue',
        quantity: '20',
      })
    ).rejects.toThrow(InventoryValidationError);

    expect(mockLedger.length).toBe(0);
  });

  it('5. Audit Trail: should retrieve complete stock ledger entries', async () => {
    await service.createMovement({
      itemId: 'item-1',
      warehouseId: 'wh-1',
      movementType: 'receipt',
      quantity: '10',
      unitCost: '50',
    });

    const entries = await service.getLedgerEntries('item-1', 'wh-1');
    expect(entries.length).toBe(1);
    expect(entries[0]?.stockValueAfter).toBe('500.0000');
  });
});