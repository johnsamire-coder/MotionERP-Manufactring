import type { CrmService } from '../crm/crm.service';
import type { CustomerCreditRepository } from './customer-credit.repository';
import { CustomerCreditService } from './customer-credit.service';

describe('CustomerCreditService — composite credit limit (plan item 6)', () => {
  let creditLimit: string | null;
  let ledger: number;
  let orders: Array<{ jobOrderNumber: string; quotationReference: string | null }>;
  const quotationValues: Record<string, number> = { 'Q-1': 10000, 'Q-2': 5000 };
  const invoiced: Record<string, number> = { 'JO-1': 4000 };
  let service: CustomerCreditService;

  beforeEach(() => {
    creditLimit = '20000.0000';
    ledger = 8000;
    orders = [
      { jobOrderNumber: 'JO-1', quotationReference: 'Q-1' },
      { jobOrderNumber: 'JO-2', quotationReference: 'Q-2' },
      { jobOrderNumber: 'JO-3', quotationReference: null },
    ];
    const repo = {
      ledgerBalance: jest.fn().mockImplementation(async () => ledger),
      openJobOrders: jest.fn().mockImplementation(async () => orders),
      quotationNetValue: jest.fn().mockImplementation(async (q: string) => quotationValues[q] ?? 0),
      postedInvoicedNet: jest.fn().mockImplementation(async (jo: string) => invoiced[jo] ?? 0),
      deliveredNotInvoicedCount: jest.fn().mockResolvedValue(2),
    } as unknown as CustomerCreditRepository;
    const crm = {
      getCustomer: jest.fn().mockImplementation(async (id: string) => ({ id, creditLimit })),
    } as unknown as CrmService;
    service = new CustomerCreditService(repo, crm);
  });

  it('1. sums the ledger balance and unbilled order value (quotation − posted invoices)', async () => {
    const s = await service.getStatus('c-1');
    // unbilled = (10000 − 4000) + (5000 − 0) + 0 (no quotation) = 11000
    expect(s.ledgerBalance).toBe('8000.0000');
    expect(s.unbilledOrders).toBe('11000.0000');
    expect(s.totalExposure).toBe('19000.0000');
    expect(s.available).toBe('1000.0000');
    expect(s.deliveredNotInvoicedCount).toBe(2);
    expect(s.exceeded).toBe(false);
  });

  it('2. over-invoiced orders never count negative', async () => {
    invoiced['JO-2'] = 9000;
    const s = await service.getStatus('c-1');
    expect(s.unbilledOrders).toBe('6000.0000');
    delete invoiced['JO-2'];
  });

  it('3. warns (never throws) once the exposure passes the limit', async () => {
    ledger = 12000;
    const w = await service.warningFor('c-1');
    expect(w?.status.exceeded).toBe(true);
    expect(w?.message).toMatch(/تجاوز حد الائتمان/);
  });

  it('4. no limit = never exceeded; no customer = no warning', async () => {
    creditLimit = null;
    ledger = 1_000_000;
    const s = await service.getStatus('c-1');
    expect(s.available).toBeNull();
    expect(s.exceeded).toBe(false);
    expect(await service.warningFor(null)).toBeNull();
  });
});
