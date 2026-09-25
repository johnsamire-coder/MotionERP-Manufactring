import type { CrmService } from './crm.service';
import type { LeadRepository } from './lead.repository';
import { LeadService } from './lead.service';
import type { LeadRecord, ProspectRecord } from './lead.types';

describe('Lead → Contact → Prospect → Customer (plan item 25)', () => {
  let leads: Map<string, LeadRecord>;
  let prospects: Map<string, ProspectRecord>;
  let customers: Array<{ code: string; name: string; status?: string; contactEmail?: string }>;
  let service: LeadService;

  beforeEach(() => {
    leads = new Map();
    prospects = new Map();
    customers = [];
    const withLeads = (p: ProspectRecord): ProspectRecord => ({
      ...p,
      leadIds: [...leads.values()].filter((l) => l.prospectId === p.id).map((l) => l.id),
    });
    const repo = {
      countLeads: jest.fn(async () => leads.size),
      countProspects: jest.fn(async () => prospects.size),
      findLead: jest.fn(async (id: string) => (leads.has(id) ? { ...leads.get(id)! } : null)),
      findDuplicate: jest.fn(
        async (email: string | null, phone: string | null) =>
          [...leads.values()].find(
            (l) =>
              !['converted', 'lost'].includes(l.status) &&
              ((email && l.email === email) || (phone && l.phone === phone)),
          ) ?? null,
      ),
      insertLead: jest.fn(async (v: Partial<LeadRecord> & { id: string }) => {
        const rec = {
          status: 'new',
          prospectId: null,
          customerId: null,
          lostReason: null,
          lastContactedAt: null,
          activities: [],
          ...v,
        } as LeadRecord;
        leads.set(v.id, rec);
        return rec;
      }),
      updateLead: jest.fn(async (id: string, f: Record<string, unknown>) => {
        const l = leads.get(id)!;
        Object.assign(
          l,
          f,
          f['lastContactedAt'] instanceof Date
            ? { lastContactedAt: (f['lastContactedAt'] as Date).toISOString() }
            : {},
        );
        return l;
      }),
      updateLeads: jest.fn(async (ids: string[], f: Partial<LeadRecord>) => {
        ids.forEach((id) => Object.assign(leads.get(id)!, f));
      }),
      insertActivity: jest.fn(async (id: string, activityType: 'call') => {
        leads.get(id)!.activities.push({ id: 'a', activityType, activityDate: '', note: null });
      }),
      findProspect: jest.fn(async (id: string) =>
        prospects.has(id) ? withLeads(prospects.get(id)!) : null,
      ),
      insertProspect: jest.fn(async (v: Partial<ProspectRecord> & { id: string }) => {
        prospects.set(v.id, {
          status: 'open',
          customerId: null,
          leadIds: [],
          ...v,
        } as ProspectRecord);
      }),
      updateProspect: jest.fn(async (id: string, f: Partial<ProspectRecord>) => {
        Object.assign(prospects.get(id)!, f);
        return withLeads(prospects.get(id)!);
      }),
    } as unknown as LeadRepository;
    const crm = {
      createCustomer: jest.fn(async (c: { code: string; name: string }) => {
        customers.push(c);
        return { id: `cust-${c.code}`, ...c };
      }),
    } as unknown as CrmService;
    service = new LeadService(repo, crm);
  });

  const newLead = (email: string, companyName = 'ACME'): Promise<LeadRecord> =>
    service.createLead({ personName: `P ${email}`, email, companyName, orgNodeId: 'org' });

  it('1. a lead needs a way to be contacted and cannot be registered twice', async () => {
    await expect(service.createLead({ personName: 'A', orgNodeId: 'org' })).rejects.toThrow(
      /phone or an email/,
    );
    const l = await newLead('a@x.com');
    expect(l.leadNumber).toMatch(/^LEAD-\d{4}-000001$/);
    await expect(newLead('A@X.com ')).rejects.toThrow(/مسجّل قبل كده/);
  });

  it('2. interested only after a real contact; a note is not a contact', async () => {
    const l = await newLead('a@x.com');
    await expect(service.act(l.id, 'interested')).rejects.toThrow(/تواصل فعلي/);
    await service.logActivity(l.id, 'note', 'saw an ad');
    expect((await service.getLead(l.id)).status).toBe('new');
    expect((await service.logActivity(l.id, 'call')).status).toBe('contacted');
    expect((await service.act(l.id, 'interested')).status).toBe('interested');
  });

  it('3. lost needs a reason; closed leads take no activity until reopened', async () => {
    const l = await newLead('a@x.com');
    await expect(service.act(l.id, 'lost')).rejects.toThrow(/reason/);
    await service.act(l.id, 'lost', 'too expensive');
    await expect(service.logActivity(l.id, 'call')).rejects.toThrow(/reopen it first/);
    expect((await service.act(l.id, 'reopen')).status).toBe('new');
  });

  const interested = async (email: string): Promise<LeadRecord> => {
    const l = await newLead(email);
    await service.logActivity(l.id, 'visit');
    return service.act(l.id, 'interested');
  };

  it('4. a prospect groups interested leads and converts them all into one customer', async () => {
    const a = await interested('a@x.com');
    const b = await newLead('b@x.com');
    await expect(
      service.createProspect({ companyName: 'ACME', orgNodeId: 'org', leadIds: [a.id, b.id] }),
    ).rejects.toThrow(/must be "interested"/);
    const p = await service.createProspect({
      companyName: 'ACME',
      orgNodeId: 'org',
      leadIds: [a.id],
    });
    await service.logActivity(b.id, 'email');
    await service.act(b.id, 'interested');
    await service.addLeadToProspect(p.id, b.id);
    await expect(service.convertLead(a.id, { code: 'X' })).rejects.toThrow(/convert the prospect/);
    const { prospect, customer } = await service.convertProspect(p.id, { code: 'ACME' });
    expect(customers).toEqual([
      expect.objectContaining({
        code: 'ACME',
        name: 'ACME',
        status: 'active',
        contactEmail: 'a@x.com',
      }),
    ]);
    expect(prospect).toMatchObject({ status: 'converted', customerId: customer.id });
    expect([leads.get(a.id)!.status, leads.get(b.id)!.status]).toEqual(['converted', 'converted']);
    await expect(service.convertProspect(p.id, { code: 'ACME2' })).rejects.toThrow(
      /already "converted"/,
    );
  });

  it('5. an individual interested lead converts directly; a lost prospect loses its leads', async () => {
    const solo = await interested('s@x.com');
    const { lead } = await service.convertLead(solo.id, { code: 'SOLO' });
    expect(lead).toMatchObject({ status: 'converted', customerId: 'cust-SOLO' });
    const c = await interested('c@x.com');
    const p = await service.createProspect({ companyName: 'C', orgNodeId: 'org', leadIds: [c.id] });
    await service.loseProspect(p.id, 'went with a competitor');
    expect(leads.get(c.id)).toMatchObject({ status: 'lost', lostReason: 'went with a competitor' });
  });
});
