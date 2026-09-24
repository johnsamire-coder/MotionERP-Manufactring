import { CatalogNotFoundError } from '../catalog/catalog.errors';
import type { CatalogService } from '../catalog/catalog.service';
import { CrmNotFoundError } from '../crm/crm.errors';
import type { CrmService } from '../crm/crm.service';
import type { RfqRepository } from './rfq.repository';
import { RfqService } from './rfq.service';
import type { CreateRfqInput, RfqRecord, RfqStatus, RfqSupplierStatus } from './rfq.types';
import { SalesNotFoundError, SalesValidationError } from './sales.errors';
import type { SalesService } from './sales.service';
import type { QuotationRecord } from './sales.types';

describe('RfqService — request for quotation to several suppliers (plan item 7)', () => {
  let store: Map<string, RfqRecord>;
  let quotations: Map<string, QuotationRecord>;
  let service: RfqService;
  let sales: {
    createQuotation: jest.Mock;
    getQuotation: jest.Mock;
    approveQuotation: jest.Mock;
    rejectQuotation: jest.Mock;
  };

  const input: CreateRfqInput = {
    lines: [
      { itemId: 'steel', quantity: '10' },
      { itemId: 'paint', quantity: '4' },
    ],
    supplierIds: ['s-a', 's-b', 's-c'],
  };

  beforeEach(() => {
    store = new Map();
    quotations = new Map();
    const repo = {
      count: jest.fn().mockImplementation(async () => store.size),
      list: jest.fn().mockImplementation(async () => [...store.values()]),
      findById: jest.fn().mockImplementation(async (id: string) => store.get(id) ?? null),
      insert: jest
        .fn()
        .mockImplementation(async (i: CreateRfqInput & { id: string; rfqNumber: string }) => {
          const rec: RfqRecord = {
            id: i.id,
            rfqNumber: i.rfqNumber,
            orgNodeId: null,
            rfqDate: '',
            respondBy: null,
            status: 'draft',
            materialRequestReference: null,
            awardedSupplierId: null,
            note: null,
            createdAt: '',
            updatedAt: '',
            lines: i.lines.map((l, n) => ({
              id: `l${n}`,
              itemId: l.itemId,
              quantity: l.quantity,
              lineNumber: n + 1,
            })),
            suppliers: i.supplierIds.map((s) => ({
              id: s,
              supplierId: s,
              status: 'pending',
              quotationId: null,
              respondedAt: null,
            })),
          };
          store.set(rec.id, rec);
          return rec;
        }),
      setStatus: jest
        .fn()
        .mockImplementation(async (id: string, status: RfqStatus, awarded?: string) => {
          const r = store.get(id)!;
          r.status = status;
          if (awarded) r.awardedSupplierId = awarded;
        }),
      setSupplierResponse: jest
        .fn()
        .mockImplementation(
          async (id: string, sup: string, status: RfqSupplierStatus, q?: string) => {
            const s = store.get(id)!.suppliers.find((x) => x.supplierId === sup)!;
            s.status = status;
            s.quotationId = q ?? null;
          },
        ),
    } as unknown as RfqRepository;
    sales = {
      createQuotation: jest.fn().mockImplementation(async (q) => {
        const rec = {
          id: `q-${q.supplierId}`,
          status: 'draft',
          lines: q.lines,
        } as unknown as QuotationRecord;
        quotations.set(rec.id, rec);
        return rec;
      }),
      getQuotation: jest.fn().mockImplementation(async (id: string) => quotations.get(id)),
      approveQuotation: jest.fn().mockImplementation(async (id: string) => {
        quotations.get(id)!.status = 'approved';
      }),
      rejectQuotation: jest.fn().mockImplementation(async (id: string) => {
        quotations.get(id)!.status = 'rejected';
      }),
    };
    const crm = {
      getSupplier: jest.fn().mockImplementation(async (id: string) => {
        if (!id.startsWith('s-')) throw new CrmNotFoundError('nope');
        return { id };
      }),
      supplierBlockReason: jest
        .fn()
        .mockImplementation(async (id: string) =>
          id === 's-held' ? 'المورد موقوف (إيقاف كامل)' : null,
        ),
    } as unknown as CrmService;
    const catalog = {
      getItem: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'ghost') throw new CatalogNotFoundError('nope');
        return { id };
      }),
    } as unknown as CatalogService;
    service = new RfqService(repo, sales as unknown as SalesService, crm, catalog);
  });

  const createAndSend = async (): Promise<RfqRecord> => {
    const r = await service.create(input);
    return service.send(r.id);
  };

  it('1. creates an RFQ for several suppliers and validates items, suppliers and lines', async () => {
    const r = await service.create(input);
    expect(r.rfqNumber).toMatch(/^RFQ-\d{4}-000001$/);
    expect(r.suppliers).toHaveLength(3);
    await expect(service.create({ ...input, supplierIds: ['s-a', 's-a'] })).rejects.toThrow(
      /at least two different suppliers/,
    );
    await expect(service.create({ ...input, supplierIds: ['s-a', 'x-b'] })).rejects.toThrow(
      SalesNotFoundError,
    );
    await expect(service.create({ ...input, supplierIds: ['s-a', 's-held'] })).rejects.toThrow(
      /موقوف/,
    );
    await expect(
      service.create({ ...input, lines: [{ itemId: 'ghost', quantity: '1' }] }),
    ).rejects.toThrow(/item ghost does not exist/);
    await expect(
      service.create({
        ...input,
        lines: [
          { itemId: 'steel', quantity: '1' },
          { itemId: 'steel', quantity: '2' },
        ],
      }),
    ).rejects.toThrow(/only once/);
  });

  it('2. answers are only accepted once sent, from invited suppliers, pricing exactly the RFQ items', async () => {
    const draft = await service.create(input);
    const prices = {
      lines: [
        { itemId: 'steel', unitPrice: '100' },
        { itemId: 'paint', unitPrice: '50' },
      ],
    };
    await expect(service.recordResponse(draft.id, 's-a', prices)).rejects.toThrow(/must be "sent"/);
    await service.send(draft.id);
    await expect(service.recordResponse(draft.id, 's-z', prices)).rejects.toThrow(/not invited/);
    await expect(
      service.recordResponse(draft.id, 's-a', { lines: [{ itemId: 'steel', unitPrice: '1' }] }),
    ).rejects.toThrow(/exactly the RFQ items/);
    const { quotation } = await service.recordResponse(draft.id, 's-a', prices);
    expect(sales.createQuotation).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'incoming', supplierId: 's-a' }),
    );
    expect(quotation.lines).toEqual([
      { itemId: 'steel', quantity: '10', unitPrice: '100' },
      { itemId: 'paint', quantity: '4', unitPrice: '50' },
    ]);
    await expect(service.recordResponse(draft.id, 's-a', prices)).rejects.toThrow(
      /already answered/,
    );
  });

  it('3. compares offers side by side and flags the lowest price per line and the lowest total', async () => {
    const r = await createAndSend();
    await service.recordResponse(r.id, 's-a', {
      lines: [
        { itemId: 'steel', unitPrice: '100' },
        { itemId: 'paint', unitPrice: '60' },
      ],
    });
    await service.recordResponse(r.id, 's-b', {
      lines: [
        { itemId: 'steel', unitPrice: '110' },
        { itemId: 'paint', unitPrice: '40' },
      ],
    });
    await service.recordDecline(r.id, 's-c');
    const c = await service.compare(r.id);
    // totals: A = 1000 + 240 = 1240 ; B = 1100 + 160 = 1260
    expect(c.suppliers.find((s) => s.supplierId === 's-a')?.total).toBe('1240.0000');
    expect(c.suppliers.find((s) => s.supplierId === 's-c')).toMatchObject({
      status: 'declined',
      total: null,
    });
    expect(c.lines[0]!.offers.find((o) => o.isLowest)?.supplierId).toBe('s-a');
    expect(c.lines[1]!.offers.find((o) => o.isLowest)?.supplierId).toBe('s-b');
    expect(c.lowestTotalSupplierId).toBe('s-a');
  });

  it('4. awarding approves the winner, rejects the other answers and closes the RFQ', async () => {
    const r = await createAndSend();
    const p = {
      lines: [
        { itemId: 'steel', unitPrice: '1' },
        { itemId: 'paint', unitPrice: '1' },
      ],
    };
    await service.recordResponse(r.id, 's-a', p);
    await service.recordResponse(r.id, 's-b', p);
    await expect(service.award(r.id, 's-c')).rejects.toThrow(/only a supplier who answered/);
    const closed = await service.award(r.id, 's-b');
    expect(closed).toMatchObject({ status: 'closed', awardedSupplierId: 's-b' });
    expect(quotations.get('q-s-b')?.status).toBe('approved');
    expect(quotations.get('q-s-a')?.status).toBe('rejected');
    await expect(service.award(r.id, 's-a')).rejects.toThrow(SalesValidationError);
    await expect(service.cancel(r.id)).rejects.toThrow(/already "closed"/);
  });
});
