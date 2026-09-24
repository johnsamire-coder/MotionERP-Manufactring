import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import type { BatchBalanceRecord, LandedCostVoucherRecord } from './inventory.types';

describe('Landed cost into per-batch cost (plan item 15)', () => {
  const voucher = (
    items: Array<{ receiptMovementId: string; allocatedExpense: string }>,
  ): LandedCostVoucherRecord =>
    ({
      id: 'v',
      voucherNumber: 'LCV-1',
      orgNodeId: 'o',
      postingDate: '',
      totalExpenseAmount: '0',
      distributeMethod: 'by_amount',
      expenseAccountId: 'acc',
      status: 'draft',
      notes: null,
      createdAt: '',
      updatedAt: '',
      items: items.map((x, n) => ({
        id: `li${n}`,
        voucherId: 'v',
        itemId: 'item',
        warehouseId: 'wh',
        quantity: '10',
        originalRate: '100',
        newValuationRate: '110',
        createdAt: '',
        ...x,
      })),
    }) as unknown as LandedCostVoucherRecord;

  let batch: BatchBalanceRecord | null;
  let posted: string | null;
  let service: InventoryService;
  let lcv: LandedCostVoucherRecord;

  beforeEach(() => {
    batch = {
      id: 'bb',
      batchId: 'lot-a',
      itemId: 'item',
      warehouseId: 'wh',
      quantity: '10',
      valuationRate: '100',
      totalValue: '1000',
      updatedAt: '',
    };
    posted = null;
    const repo = {
      findLandedCostVoucherById: jest.fn().mockImplementation(async () => lcv),
      findMovementById: jest.fn().mockImplementation(async (id: string) => ({
        id,
        batchId: id === 'batch-receipt' ? 'lot-a' : null,
      })),
      findBatchBalance: jest.fn().mockImplementation(async () => batch),
      upsertBatchBalance: jest.fn().mockImplementation(async (b) => {
        batch = { ...batch!, ...b };
        return batch;
      }),
      findBalance: jest.fn().mockResolvedValue({ onHand: '10', totalValue: '1000' }),
      applyValuation: jest.fn(),
      insertLedgerEntry: jest.fn(),
      setLandedCostVoucherStatus: jest.fn().mockImplementation(async (_id: string, s: string) => {
        posted = s;
        return lcv;
      }),
    } as unknown as InventoryRepository;
    service = new InventoryService(repo);
  });

  it('1. adds the allocated expense to the receipt batch cost', async () => {
    lcv = voucher([{ receiptMovementId: 'batch-receipt', allocatedExpense: '100' }]);
    await service.postLandedCostVoucher('v');
    expect(batch).toMatchObject({
      totalValue: '1100.000000',
      valuationRate: '110.000000',
      quantity: '10',
    });
    expect(posted).toBe('posted');
  });

  it('2. refuses (before writing anything) when the batch no longer has stock there', async () => {
    batch = { ...batch!, quantity: '0', totalValue: '0' };
    lcv = voucher([{ receiptMovementId: 'batch-receipt', allocatedExpense: '100' }]);
    await expect(service.postLandedCostVoucher('v')).rejects.toThrow(/لم يعد لها رصيد/);
    expect(posted).toBeNull();
  });

  it('3. non-batch receipts behave exactly as before', async () => {
    lcv = voucher([{ receiptMovementId: 'plain-receipt', allocatedExpense: '100' }]);
    await service.postLandedCostVoucher('v');
    expect(batch?.totalValue).toBe('1000');
    expect(posted).toBe('posted');
  });
});
