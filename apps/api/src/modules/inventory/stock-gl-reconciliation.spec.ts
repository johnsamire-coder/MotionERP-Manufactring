import { compareStockWithGl } from './stock-gl-reconciliation.service';

describe('Stock ↔ ledger reconciliation (plan item 35)', () => {
  const acc = (inv: string) => ({ inventoryAccountId: inv, contraAccountId: 'adj' });
  const gl: Record<string, number> = { inv1: 900, inv2: 500 };
  const run = (rows: Parameters<typeof compareStockWithGl>[0]) => compareStockWithGl(rows, (id) => gl[id] ?? 0, (id) => id.toUpperCase());

  it('1. groups warehouses by inventory account and reports each difference', () => {
    const r = run([
      { id: 'w1', code: 'W1', stockValue: 600, accounts: acc('inv1') },
      { id: 'w2', code: 'W2', stockValue: 400, accounts: acc('inv1') },
      { id: 'w3', code: 'W3', stockValue: 500, accounts: acc('inv2') },
    ]);
    expect(r.accounts.find((a) => a.inventoryAccountId === 'inv1')).toMatchObject({ glBalance: '900.0000', stockValue: '1000.0000', difference: '100.0000' });
    expect(r.accounts.find((a) => a.inventoryAccountId === 'inv2')!.difference).toBe('0.0000');
    expect(r.balanced).toBe(false);
    expect(r.suggestedLines).toEqual([
      { accountId: 'inv1', debitAmount: '100.0000', creditAmount: '0' },
      { accountId: 'adj', debitAmount: '0', creditAmount: '100.0000' },
    ]);
  });

  it('2. ledger above stock → credit the inventory account', () => {
    const r = run([{ id: 'w1', code: 'W1', stockValue: 850, accounts: acc('inv1') }]);
    expect(r.suggestedLines[0]).toEqual({ accountId: 'inv1', debitAmount: '0', creditAmount: '50.0000' });
  });

  it('3. warehouses without accounts are listed apart; matching books need no entry', () => {
    const r = run([{ id: 'w1', code: 'W1', stockValue: 900, accounts: acc('inv1') }, { id: 'w9', code: 'W9', stockValue: 70, accounts: null }]);
    expect(r.balanced).toBe(true);
    expect(r.suggestedLines).toEqual([]);
    expect(r.unmappedWarehouses).toEqual([{ id: 'w9', code: 'W9', stockValue: '70.0000' }]);
  });
});
