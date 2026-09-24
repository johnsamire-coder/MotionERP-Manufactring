import type { SalesService } from '../sales/sales.service';
import type { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import type { PurchaseInvoiceHoldService } from './purchase-invoice-hold.service';

describe('Hold on a single purchase invoice (plan item 19)', () => {
  it('blocks payments against the held invoice only', async () => {
    const holds = {
      blockReason: jest
        .fn()
        .mockImplementation(async (id: string) =>
          id === 'held' ? 'فاتورة الشراء موقوفة عن الدفع — السبب: نزاع' : null,
        ),
    };
    const repo = {
      countPayments: jest.fn().mockResolvedValue(0),
      insertPayment: jest.fn().mockImplementation(async (p) => p),
    } as unknown as FinanceRepository;
    const service = new FinanceService(
      repo,
      {} as SalesService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      holds as unknown as PurchaseInvoiceHoldService,
    );
    const pay = {
      orgNodeId: 'o',
      amount: '10',
      paymentMethod: 'cash' as const,
      paidFromAccountId: 'acc',
    };
    await expect(service.createPayment({ ...pay, purchaseInvoiceId: 'held' })).rejects.toThrow(
      /موقوفة عن الدفع/,
    );
    await expect(
      service.createPayment({ ...pay, purchaseInvoiceId: 'other' }),
    ).resolves.toBeDefined();
    await expect(service.createPayment(pay)).resolves.toBeDefined();
  });
});
