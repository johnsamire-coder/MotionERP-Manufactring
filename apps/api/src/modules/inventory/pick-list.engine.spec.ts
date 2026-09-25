import { planPicks, type PickBatchRow } from './pick-list.engine';

describe('Pick list engine — FIFO / earliest expiry (plan item 27)', () => {
  const today = new Date('2026-06-15T10:00:00Z');
  const b = (
    batchId: string,
    warehouseId: string,
    quantity: number,
    expiryDate: string | null,
    extra: Partial<PickBatchRow> = {},
  ): PickBatchRow => ({
    itemId: 'med',
    warehouseId,
    batchId,
    quantity,
    expiryDate,
    manufacturingDate: null,
    createdAt: '2026-01-01',
    status: 'active',
    ...extra,
  });
  const isBatch = (id: string): boolean => id === 'med';

  it('1. takes the batch expiring first, skips expired and blocked batches', () => {
    const plan = planPicks(
      [{ itemId: 'med', quantity: 12 }],
      isBatch,
      [{ itemId: 'med', warehouseId: 'w1', available: 100 }],
      [
        b('late', 'w1', 50, '2027-01-01'),
        b('soon', 'w1', 10, '2026-07-01'),
        b('expired', 'w1', 99, '2026-06-14'),
        b('recalled', 'w1', 99, '2026-06-20', { status: 'recalled' }),
      ],
      today,
    );
    expect(plan.lines).toEqual([
      { itemId: 'med', warehouseId: 'w1', batchId: 'soon', quantity: 10 },
      { itemId: 'med', warehouseId: 'w1', batchId: 'late', quantity: 2 },
    ]);
    expect(plan.shortfalls).toEqual([]);
  });

  it('2. same expiry → oldest batch first (FIFO); no expiry comes last', () => {
    const plan = planPicks(
      [{ itemId: 'med', quantity: 6 }],
      isBatch,
      [{ itemId: 'med', warehouseId: 'w1', available: 100 }],
      [
        b('none', 'w1', 50, null),
        b('new', 'w1', 5, '2026-09-01', { createdAt: '2026-05-01' }),
        b('old', 'w1', 5, '2026-09-01', { createdAt: '2026-02-01' }),
      ],
      today,
    );
    expect(plan.lines.map((l) => [l.batchId, l.quantity])).toEqual([
      ['old', 5],
      ['new', 1],
    ]);
  });

  it('3. never picks more than the warehouse has free (reserved stock stays)', () => {
    const plan = planPicks(
      [{ itemId: 'med', quantity: 30 }],
      isBatch,
      [
        { itemId: 'med', warehouseId: 'w1', available: 8 },
        { itemId: 'med', warehouseId: 'w2', available: 40 },
      ],
      [b('a', 'w1', 20, '2026-07-01'), b('b', 'w2', 10, '2026-08-01')],
      today,
    );
    expect(plan.lines.map((l) => [l.warehouseId, l.batchId, l.quantity])).toEqual([
      ['w1', 'a', 8],
      ['w2', 'b', 10],
    ]);
    expect(plan.shortfalls).toEqual([{ itemId: 'med', requested: 30, picked: 18, missing: 12 }]);
  });

  it('4. plain items: fullest warehouse first; repeated requests are merged', () => {
    const plan = planPicks(
      [
        { itemId: 'bolt', quantity: 30 },
        { itemId: 'bolt', quantity: 20 },
      ],
      isBatch,
      [
        { itemId: 'bolt', warehouseId: 'w1', available: 10 },
        { itemId: 'bolt', warehouseId: 'w2', available: 45 },
      ],
      [],
      today,
    );
    expect(plan.lines.map((l) => [l.warehouseId, l.batchId, l.quantity])).toEqual([
      ['w2', null, 45],
      ['w1', null, 5],
    ]);
  });
});
