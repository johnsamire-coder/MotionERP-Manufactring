import type { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import type { SalesService } from '../sales/sales.service';

describe('Duplicate supplier invoice number (plan item 18)', () => {
  it('answers 400 with the existing invoice instead of hitting the unique constraint', async () => {
    const repo = {
      findPurchaseInvoiceBySupplierNumber: jest.fn().mockImplementation(async (_s: string, n: string) =>
        n === 'INV-7' ? { systemNumber: 'PINV-2026-000001', invoiceDate: new Date('2026-03-01T00:00:00Z'), status: 'posted' } : null),
      countPurchaseInvoices: jest.fn().mockResolvedValue(0),
      insertPurchaseInvoice: jest.fn().mockImplementation(async (i) => i),
    } as unknown as FinanceRepository;
    const service = new FinanceService(repo, {} as SalesService);
    const input = {
      orgNodeId: 'o', supplierId: 's', invoiceDate: '2026-05-01', dueDate: '2026-05-01',
      lines: [{ itemId: 'i', quantity: '1', unitCost: '10' }],
    };
    await expect(service.createPurchaseInvoice({ ...input, invoiceNumber: 'INV-7' }))
      .rejects.toThrow(/INV-7.*PINV-2026-000001 بتاريخ 2026-03-01 \(posted\)/);
    await expect(service.createPurchaseInvoice({ ...input, invoiceNumber: 'INV-8' })).resolves.toBeDefined();
  });
});
