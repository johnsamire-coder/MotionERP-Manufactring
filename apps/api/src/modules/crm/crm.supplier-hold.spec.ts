import type { CrmRepository } from './crm.repository';
import { CrmService } from './crm.service';
import type { SupplierRecord } from './crm.types';

describe('Supplier hold (plan item 8)', () => {
  let supplier: SupplierRecord;
  let service: CrmService;

  beforeEach(() => {
    supplier = {
      id: 's-1', code: 'S1', name: 'المصرية للصلب', contactPhone: null, contactEmail: null, orgNodeId: 'o',
      status: 'active', holdType: null, holdReason: null, holdReleaseDate: null, createdAt: '', updatedAt: '',
    };
    const repo = {
      findSupplierById: jest.fn().mockImplementation(async () => supplier),
      setSupplierHold: jest.fn().mockImplementation(async (_id: string, h) => {
        supplier = { ...supplier, holdType: h.holdType, holdReason: h.holdReason,
          holdReleaseDate: h.holdReleaseDate ? h.holdReleaseDate.toISOString() : null };
        return supplier;
      }),
    } as unknown as CrmRepository;
    service = new CrmService(repo);
  });

  const blocked = async (): Promise<Record<string, boolean>> => ({
    rfq: !!(await service.supplierBlockReason('s-1', 'rfq')),
    quotation: !!(await service.supplierBlockReason('s-1', 'quotation')),
    invoice: !!(await service.supplierBlockReason('s-1', 'invoice')),
    payment: !!(await service.supplierBlockReason('s-1', 'payment')),
  });

  it('1. no hold blocks nothing', async () => {
    expect(await blocked()).toEqual({ rfq: false, quotation: false, invoice: false, payment: false });
  });

  it('2. the three levels block exactly their documents', async () => {
    await service.setSupplierHold('s-1', { holdType: 'all', reason: 'نزاع جودة' });
    expect(await blocked()).toEqual({ rfq: true, quotation: true, invoice: true, payment: true });
    expect(await service.supplierBlockReason('s-1', 'payment')).toMatch(/إيقاف كامل.*نزاع جودة/);
    await service.setSupplierHold('s-1', { holdType: 'invoices' });
    expect(await blocked()).toEqual({ rfq: false, quotation: false, invoice: true, payment: false });
    await service.setSupplierHold('s-1', { holdType: 'payments' });
    expect(await blocked()).toEqual({ rfq: false, quotation: false, invoice: false, payment: true });
    await service.setSupplierHold('s-1', { holdType: null });
    expect(await blocked()).toEqual({ rfq: false, quotation: false, invoice: false, payment: false });
  });

  it('3. the release date lifts the hold automatically once reached', async () => {
    await service.setSupplierHold('s-1', { holdType: 'all', releaseDate: new Date(Date.now() + 86_400_000).toISOString() });
    expect((await blocked()).invoice).toBe(true);
    supplier.holdReleaseDate = new Date(Date.now() - 1000).toISOString(); // time passes
    expect(await blocked()).toEqual({ rfq: false, quotation: false, invoice: false, payment: false });
    expect(service.effectiveHold(supplier)).toBeNull();
  });

  it('4. rejects a release date in the past', async () => {
    await expect(service.setSupplierHold('s-1', { holdType: 'all', releaseDate: '2020-01-01' })).rejects.toThrow(/future/);
  });
});
