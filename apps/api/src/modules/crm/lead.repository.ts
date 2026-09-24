import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, notInArray, or } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { lead, leadActivity, prospect } from './crm.schema';
import type { LeadActivityType, LeadRecord, LeadStatus, ProspectRecord, ProspectStatus } from './lead.types';

type LeadRow = typeof lead.$inferSelect;
type LeadFields = Partial<Pick<LeadRow, 'status' | 'prospectId' | 'customerId' | 'lostReason' | 'lastContactedAt'>>;

@Injectable()
export class LeadRepository {
  constructor(private readonly database: DatabaseService) {}

  async countLeads(): Promise<number> {
    return Number((await this.database.db.select({ n: count() }).from(lead))[0]?.n ?? 0);
  }

  async countProspects(): Promise<number> {
    return Number((await this.database.db.select({ n: count() }).from(prospect))[0]?.n ?? 0);
  }

  async listLeads(status?: LeadStatus): Promise<LeadRecord[]> {
    const q = this.database.db.select().from(lead);
    const rows = status ? await q.where(eq(lead.status, status)).orderBy(asc(lead.createdAt)) : await q.orderBy(asc(lead.createdAt));
    return Promise.all(rows.map((r) => this.withActivities(r)));
  }

  async findLead(id: string): Promise<LeadRecord | null> {
    const r = (await this.database.db.select().from(lead).where(eq(lead.id, id)).limit(1))[0];
    return r ? this.withActivities(r) : null;
  }

  /** A lead sharing the email or phone that is not converted or lost (do-not-contact still counts). */
  async findDuplicate(email: string | null, phone: string | null): Promise<LeadRecord | null> {
    const conds = [email ? eq(lead.email, email) : undefined, phone ? eq(lead.phone, phone) : undefined].filter((c) => c !== undefined);
    if (conds.length === 0) return null;
    const r = (await this.database.db.select().from(lead)
      .where(and(or(...conds), notInArray(lead.status, ['converted', 'lost']))).limit(1))[0];
    return r ? this.withActivities(r) : null;
  }

  async insertLead(values: typeof lead.$inferInsert): Promise<LeadRecord> {
    await this.database.db.insert(lead).values(values);
    return (await this.findLead(values.id!))!;
  }

  async updateLead(id: string, fields: LeadFields): Promise<LeadRecord> {
    await this.database.db.update(lead).set({ ...fields, updatedAt: new Date() }).where(eq(lead.id, id));
    return (await this.findLead(id))!;
  }

  async updateLeads(ids: string[], fields: LeadFields): Promise<void> {
    if (ids.length === 0) return;
    await this.database.db.update(lead).set({ ...fields, updatedAt: new Date() }).where(inArray(lead.id, ids));
  }

  async insertActivity(leadId: string, activityType: LeadActivityType, note: string | null, at: Date): Promise<void> {
    await this.database.db.insert(leadActivity).values({ leadId, activityType, note, activityDate: at });
  }

  async listProspects(): Promise<ProspectRecord[]> {
    const rows = await this.database.db.select().from(prospect).orderBy(asc(prospect.createdAt));
    return Promise.all(rows.map((r) => this.withLeads(r)));
  }

  async findProspect(id: string): Promise<ProspectRecord | null> {
    const r = (await this.database.db.select().from(prospect).where(eq(prospect.id, id)).limit(1))[0];
    return r ? this.withLeads(r) : null;
  }

  async insertProspect(values: typeof prospect.$inferInsert): Promise<void> {
    await this.database.db.insert(prospect).values(values);
  }

  async updateProspect(id: string, fields: { status?: ProspectStatus; customerId?: string | null }): Promise<ProspectRecord> {
    await this.database.db.update(prospect).set({ ...fields, updatedAt: new Date() }).where(eq(prospect.id, id));
    return (await this.findProspect(id))!;
  }

  private async withActivities(r: LeadRow): Promise<LeadRecord> {
    const acts = await this.database.db.select().from(leadActivity).where(eq(leadActivity.leadId, r.id)).orderBy(asc(leadActivity.activityDate));
    return {
      id: r.id, leadNumber: r.leadNumber, personName: r.personName, companyName: r.companyName, phone: r.phone, email: r.email,
      source: r.source, orgNodeId: r.orgNodeId, status: r.status as LeadStatus, prospectId: r.prospectId, customerId: r.customerId,
      lostReason: r.lostReason, lastContactedAt: r.lastContactedAt ? r.lastContactedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      activities: acts.map((a) => ({ id: a.id, activityType: a.activityType as LeadActivityType, activityDate: a.activityDate.toISOString(), note: a.note })),
    };
  }

  private async withLeads(r: typeof prospect.$inferSelect): Promise<ProspectRecord> {
    const leads = await this.database.db.select({ id: lead.id }).from(lead).where(eq(lead.prospectId, r.id)).orderBy(asc(lead.createdAt));
    return {
      id: r.id, prospectNumber: r.prospectNumber, companyName: r.companyName, industry: r.industry, orgNodeId: r.orgNodeId,
      status: r.status as ProspectStatus, customerId: r.customerId, note: r.note,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), leadIds: leads.map((l) => l.id),
    };
  }
}
