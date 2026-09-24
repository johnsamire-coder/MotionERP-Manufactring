import { buildClosingLines } from './year-end-closing.service';

describe('Year-end closing lines (plan item 36)', () => {
  const re = { id: 're', code: '3101', name: 'أرباح محتجزة' };
  const row = (accountId: string, typeCode: string, debit: number, credit: number) => ({ accountId, code: accountId, name: accountId, typeCode, debit, credit });

  it('1. zeroes revenue, COGS and expenses; the profit goes to retained earnings', () => {
    const r = buildClosingLines([
      row('sales', 'revenue', 0, 1000), row('sales', 'revenue', 50, 0), // returns
      row('cogs', 'cogs', 600, 0), row('rent', 'expense', 100, 0),
      row('cash', 'asset', 1000, 0), // balance-sheet accounts are never touched
    ], re);
    expect(r.netProfit).toBe(250);
    expect(r.lines).toEqual([
      { accountId: 'sales', accountCode: 'sales', accountName: 'sales', debitAmount: '950.0000', creditAmount: '0' },
      { accountId: 'cogs', accountCode: 'cogs', accountName: 'cogs', debitAmount: '0', creditAmount: '600.0000' },
      { accountId: 'rent', accountCode: 'rent', accountName: 'rent', debitAmount: '0', creditAmount: '100.0000' },
      { accountId: 're', accountCode: '3101', accountName: 'أرباح محتجزة', debitAmount: '0', creditAmount: '250.0000' },
    ]);
    const dr = r.lines.reduce((s, l) => s + Number(l.debitAmount), 0);
    const cr = r.lines.reduce((s, l) => s + Number(l.creditAmount), 0);
    expect(dr).toBeCloseTo(cr, 4);
  });

  it('2. a loss debits retained earnings', () => {
    const r = buildClosingLines([row('sales', 'revenue', 0, 100), row('rent', 'expense', 300, 0)], re);
    expect(r.netProfit).toBe(-200);
    expect(r.lines.at(-1)).toMatchObject({ accountId: 're', debitAmount: '200.0000', creditAmount: '0' });
  });

  it('3. nothing to close → no lines', () => {
    expect(buildClosingLines([row('cash', 'asset', 5, 0)], re).lines).toEqual([]);
  });
});
