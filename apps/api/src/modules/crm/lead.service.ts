import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CrmNotFoundError, CrmValidationError } from './crm.errors';
import { CrmService } from './crm.service';
import type { CustomerRecord } from './crm.types';
import { LeadRepository } from './lead.repository';
import type { CreateLeadInput, CreateProspectInput, LeadActivityType, LeadRecord, LeadStatus, ProspectRecord } from './lead.types';

export type LeadAction = 'interested' | 'lost' | 'do_not_contact' | 'reopen';
const CLOSED: readonly LeadStatus[] = ['converted', 'lost', 'do_not_contact'];
const ACTIONS_FROM: Record<LeadAction, readonly LeadStatus[]> = {
  interested: ['contacted'],
  lost: ['new', 'contacted', 'interested'],
  do_not_contact: ['new', 'contacted', 'interested', 'lost'],
  reopen: ['lost', 'do_not_contact'],
};
const clean = (v?: string | null): string | null => (v && v.trim() ? v.trim() : null);

/** Lead → Contact → Prospect → Customer (plan item 25). */
@Injectable()
export class LeadService {
  constructor(private readonly repository: LeadRepository, private readonly crm: CrmService) {}

  async listLeads(status?: LeadStatus): Promise<LeadRecord[]> { return this.repository.listLeads(status); }

  async getLead(id: string): Promise<LeadRecord> {
    const found = await this.repository.findLead(id);
    if (!found) throw new CrmNotFoundError(`lead ${id} does not exist`);
    return found;
  }

  async createLead(input: CreateLeadInput): Promise<LeadRecord> {
    const personName = clean(input.personName);
    if (!personName) throw new CrmValidationError('personName is required');
    const email = clean(input.email)?.toLowerCase() ?? null;
    const phone = clean(input.phone);
    if (!email && !phone) throw new CrmValidationError('a lead needs a phone or an email to be contacted');
    const dup = await this.repository.findDuplicate(email, phone);
    if (dup) throw new CrmValidationError(`العميل المحتمل ده مسجّل قبل كده: ${dup.leadNumber} (${dup.personName})`);
    const n = (await this.repository.countLeads()) + 1;
    return this.repository.insertLead({
      id: randomUUID(), leadNumber: `LEAD-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`,
      personName, companyName: clean(input.companyName), phone, email, source: clean(input.source), orgNodeId: input.orgNodeId,
    });
  }

  /** Logs a call / visit / email (a real contact) or a plain note. The first contact moves a new lead to "contacted". */
  async logActivity(id: string, activityType: LeadActivityType, note?: string, activityDate?: string): Promise<LeadRecord> {
    const l = await this.getLead(id);
    if (CLOSED.includes(l.status)) throw new CrmValidationError(`lead ${l.leadNumber} is "${l.status}" — reopen it first`);
    const at = activityDate ? new Date(activityDate) : new Date();
    if (Number.isNaN(at.getTime())) throw new CrmValidationError('activityDate is not a valid date');
    await this.repository.insertActivity(id, activityType, clean(note), at);
    if (activityType === 'note') return this.getLead(id);
    const last = l.lastContactedAt && new Date(l.lastContactedAt) > at ? new Date(l.lastContactedAt) : at;
    return this.repository.updateLead(id, { status: l.status === 'new' ? 'contacted' : l.status, lastContactedAt: last });
  }

  async act(id: string, action: LeadAction, reason?: string): Promise<LeadRecord> {
    const l = await this.getLead(id);
    if (!ACTIONS_FROM[action].includes(l.status)) {
      const hint = action === 'interested' && l.status === 'new' ? ' — لازم يتسجّل تواصل فعلي (مكالمة/زيارة/إيميل) الأول' : '';
      throw new CrmValidationError(`cannot "${action}" lead ${l.leadNumber} while it is "${l.status}"${hint}`);
    }
    if (action === 'lost') {
      if (!clean(reason)) throw new CrmValidationError('a reason is required to mark a lead lost');
      return this.repository.updateLead(id, { status: 'lost', lostReason: clean(reason) });
    }
    if (action === 'reopen') {
      return this.repository.updateLead(id, { status: l.lastContactedAt ? 'contacted' : 'new', lostReason: null });
    }
    return this.repository.updateLead(id, { status: action });
  }

  async listProspects(): Promise<ProspectRecord[]> { return this.repository.listProspects(); }

  async getProspect(id: string): Promise<ProspectRecord> {
    const found = await this.repository.findProspect(id);
    if (!found) throw new CrmNotFoundError(`prospect ${id} does not exist`);
    return found;
  }

  /** Groups interested leads of one company into a prospect. */
  async createProspect(input: CreateProspectInput): Promise<ProspectRecord> {
    const companyName = clean(input.companyName);
    if (!companyName) throw new CrmValidationError('companyName is required');
    const ids = [...new Set(input.leadIds)];
    if (ids.length === 0) throw new CrmValidationError('a prospect needs at least one interested lead');
    for (const leadId of ids) await this.mustBeInterested(leadId);
    const id = randomUUID();
    const n = (await this.repository.countProspects()) + 1;
    await this.repository.insertProspect({
      id, prospectNumber: `PRS-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`,
      companyName, industry: clean(input.industry), orgNodeId: input.orgNodeId, note: clean(input.note),
    });
    await this.repository.updateLeads(ids, { status: 'prospect', prospectId: id });
    return this.getProspect(id);
  }

  async addLeadToProspect(prospectId: string, leadId: string): Promise<ProspectRecord> {
    const p = await this.openProspect(prospectId);
    await this.mustBeInterested(leadId);
    await this.repository.updateLeads([leadId], { status: 'prospect', prospectId: p.id });
    return this.getProspect(p.id);
  }

  /** Converts the prospect into a real customer; every lead under it becomes "converted". */
  async convertProspect(id: string, input: { code: string; creditLimit?: string | null }): Promise<{ prospect: ProspectRecord; customer: CustomerRecord }> {
    const p = await this.openProspect(id);
    const leads = await Promise.all(p.leadIds.map((l) => this.getLead(l)));
    const customer = await this.crm.createCustomer({
      code: input.code, name: p.companyName, orgNodeId: p.orgNodeId, status: 'active', creditLimit: input.creditLimit ?? null,
      contactPhone: leads.find((l) => l.phone)?.phone ?? undefined, contactEmail: leads.find((l) => l.email)?.email ?? undefined,
    });
    await this.repository.updateLeads(p.leadIds, { status: 'converted', customerId: customer.id });
    return { prospect: await this.repository.updateProspect(id, { status: 'converted', customerId: customer.id }), customer };
  }

  /** Converts an individual interested lead (not part of a prospect) straight into a customer. */
  async convertLead(id: string, input: { code: string; creditLimit?: string | null }): Promise<{ lead: LeadRecord; customer: CustomerRecord }> {
    const l = await this.getLead(id);
    if (l.prospectId) throw new CrmValidationError(`lead ${l.leadNumber} belongs to a prospect — convert the prospect instead`);
    if (l.status !== 'interested') throw new CrmValidationError(`only an interested lead can become a customer (lead ${l.leadNumber} is "${l.status}")`);
    const customer = await this.crm.createCustomer({
      code: input.code, name: l.companyName ?? l.personName, orgNodeId: l.orgNodeId, status: 'active', creditLimit: input.creditLimit ?? null,
      contactPhone: l.phone ?? undefined, contactEmail: l.email ?? undefined,
    });
    return { lead: await this.repository.updateLead(id, { status: 'converted', customerId: customer.id }), customer };
  }

  /** The prospect did not buy: it and its leads are marked lost with the reason. */
  async loseProspect(id: string, reason: string): Promise<ProspectRecord> {
    const p = await this.openProspect(id);
    if (!clean(reason)) throw new CrmValidationError('a reason is required to mark a prospect lost');
    await this.repository.updateLeads(p.leadIds, { status: 'lost', lostReason: clean(reason) });
    return this.repository.updateProspect(id, { status: 'lost' });
  }

  private async openProspect(id: string): Promise<ProspectRecord> {
    const p = await this.getProspect(id);
    if (p.status !== 'open') throw new CrmValidationError(`prospect ${p.prospectNumber} is already "${p.status}"`);
    return p;
  }

  private async mustBeInterested(leadId: string): Promise<LeadRecord> {
    const l = await this.getLead(leadId);
    if (l.status !== 'interested' || l.prospectId) {
      throw new CrmValidationError(`lead ${l.leadNumber} must be "interested" and not already in a prospect (it is "${l.status}")`);
    }
    return l;
  }
}
