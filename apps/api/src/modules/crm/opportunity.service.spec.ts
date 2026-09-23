import type { CrmRepository } from './crm.repository';
import type { OpportunityRepository } from './opportunity.repository';
import { OpportunityService } from './opportunity.service';
import type { OpportunityRecord } from './opportunity.types';

describe('Opportunity stage between lead and quotation (plan item 17)', () => {
  let store: Map<string, OpportunityRecord>;
  let service: OpportunityService;

  beforeEach(() => {
    store = new Map();
    const repo = {
      count: jest.fn().mockImplementation(async () => store.size),
      insert: jest.fn().mockImplementation(async (i) => {
        const r = { ...i, stage: 'open', probability: i.probability ?? 10, lostReason: null, quotationId: null, items: i.items ?? [] } as OpportunityRecord;
        store.set(r.id, r);
        return r;
      }),
      findById: jest.fn().mockImplementation(async (id: string) => store.get(id) ?? null),
      findByQuotation: jest.fn().mockImplementation(async (q: string) => [...store.values()].find((o) => o.quotationId === q) ?? null),
      update: jest.fn().mockImplementation(async (id: string, f: Partial<OpportunityRecord>) => Object.assign(store.get(id)!, f)),
    } as unknown as OpportunityRepository;
    const crm = {
      findCustomerById: jest.fn().mockImplementation(async (id: string) =>
        id === 'lead-1' ? { id, code: 'L1', status: 'lead' } : id === 'arch' ? { id, code: 'A', status: 'archived' } : null),
    } as unknown as CrmRepository;
    service = new OpportunityService(repo, crm);
  });

  it('1. a lead gets an opportunity; archived / unknown customers do not', async () => {
    const o = await service.create({ customerId: 'lead-1', title: 'خط إنتاج جديد', items: [{ itemId: 'i', quantity: '5' }] });
    expect(o).toMatchObject({ stage: 'open', opportunityNumber: expect.stringMatching(/^OPP-\d{4}-000001$/) });
    await expect(service.create({ customerId: 'arch', title: 'x' })).rejects.toThrow(/archived/);
    await expect(service.create({ customerId: 'nope', title: 'x' })).rejects.toThrow(/does not exist/);
  });

  it('2. manual stages: open → qualified → lost needs a reason; quoted/won come from quotations', async () => {
    const o = await service.create({ customerId: 'lead-1', title: 't' });
    await service.moveStage(o.id, 'qualified');
    await expect(service.moveStage(o.id, 'lost')).rejects.toThrow(/lostReason is required/);
    await expect(service.moveStage(o.id, 'won' as never)).rejects.toThrow(/cannot move/);
    const q = await service.markQuoted(o.id, 'quote-1');
    expect(q).toMatchObject({ stage: 'quoted', quotationId: 'quote-1', probability: 50 });
    await expect(service.markQuoted(o.id, 'quote-2')).rejects.toThrow(/cannot be quoted/);
    const won = await service.markWonByQuotation('quote-1');
    expect(won).toMatchObject({ stage: 'won', probability: 100 });
    expect(await service.markWonByQuotation('unrelated')).toBeNull();
  });
});
