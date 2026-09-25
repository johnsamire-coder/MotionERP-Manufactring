import { installmentStatus, spreadOverInstallments } from './allocation.service';

describe('Allocation over several invoices / installments (plan item 39)', () => {
  const inst = [
    { n: 1, dueDate: '2026-10-01', amount: 300 },
    { n: 2, dueDate: '2026-11-01', amount: 300 },
    { n: 3, dueDate: '2026-12-01', amount: 400 },
  ];

  it('1. untagged coverage pays the earliest installments first; tagged pays its own', () => {
    const s = installmentStatus(inst, new Map([[3, 100]]), 350);
    expect(s.map((i) => [i.installmentNumber, i.paid, i.outstanding])).toEqual([
      [1, '300.0000', '0.0000'],
      [2, '50.0000', '250.0000'],
      [3, '100.0000', '300.0000'],
    ]);
  });

  it('2. an amount spreads earliest-due first', () => {
    const s = installmentStatus(inst, new Map(), 0);
    expect(spreadOverInstallments(450, s)).toEqual([
      { installmentNumber: 1, amount: 300 },
      { installmentNumber: 2, amount: 150 },
    ]);
  });

  it('3. a chosen installment is used alone and capped by its outstanding', () => {
    const s = installmentStatus(inst, new Map(), 0);
    expect(spreadOverInstallments(200, s, 3)).toEqual([{ installmentNumber: 3, amount: 200 }]);
    expect(() => spreadOverInstallments(500, s, 3)).toThrow(/متبقي منه 400/);
    expect(() => spreadOverInstallments(1, s, 9)).toThrow(/مش موجود/);
  });

  it('4. no installments → one untagged piece', () => {
    expect(spreadOverInstallments(80, [])).toEqual([{ installmentNumber: null, amount: 80 }]);
  });
});
