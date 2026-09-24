import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { CrmNotFoundError, CrmValidationError } from './crm.errors';
import { CrmRepository } from './crm.repository';
import { partyGroup } from './crm.schema';
import type { CustomerRecord, SupplierRecord } from './crm.types';

export type PartyGroupType = 'customer' | 'supplier';
export interface PartyGroupRecord {
  id: string;
  groupType: PartyGroupType;
  code: string;
  name: string;
  parentGroupId: string | null;
  isGroup: boolean;
  defaultCreditLimit: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface PartyGroupNode extends PartyGroupRecord {
  memberCount: number;
  totalMembers: number;
  children: PartyGroupNode[];
}
export interface CreatePartyGroupInput {
  groupType: PartyGroupType;
  code: string;
  name: string;
  parentGroupId?: string | null;
  isGroup?: boolean;
  defaultCreditLimit?: string | null;
}

/** Builds the group tree with direct and subtree member counts (pure). */
export function buildGroupTree(
  groups: PartyGroupRecord[],
  memberGroupIds: Array<string | null | undefined>,
): PartyGroupNode[] {
  const direct = new Map<string, number>();
  for (const g of memberGroupIds) if (g) direct.set(g, (direct.get(g) ?? 0) + 1);
  const build = (g: PartyGroupRecord): PartyGroupNode => {
    const children = groups.filter((c) => c.parentGroupId === g.id).map(build);
    const memberCount = direct.get(g.id) ?? 0;
    return {
      ...g,
      memberCount,
      totalMembers: children.reduce((s, c) => s + c.totalMembers, memberCount),
      children,
    };
  };
  return groups.filter((g) => !g.parentGroupId).map(build);
}

const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Customer / supplier groups as trees (plan item 28). */
@Injectable()
export class PartyGroupService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crm: CrmRepository,
  ) {}

  async list(groupType: PartyGroupType): Promise<PartyGroupRecord[]> {
    const rows = await this.database.db
      .select()
      .from(partyGroup)
      .where(eq(partyGroup.groupType, groupType))
      .orderBy(asc(partyGroup.code));
    return rows.map(toRecord);
  }

  async tree(groupType: PartyGroupType): Promise<PartyGroupNode[]> {
    const members =
      groupType === 'customer'
        ? (await this.crm.listCustomers()).map((c) => c.customerGroupId)
        : (await this.crm.listSuppliers()).map((s) => s.supplierGroupId);
    return buildGroupTree(await this.list(groupType), members);
  }

  async get(id: string): Promise<PartyGroupRecord> {
    const r = (
      await this.database.db.select().from(partyGroup).where(eq(partyGroup.id, id)).limit(1)
    )[0];
    if (!r) throw new CrmNotFoundError(`group ${id} does not exist`);
    return toRecord(r);
  }

  async create(input: CreatePartyGroupInput): Promise<PartyGroupRecord> {
    const code = input.code?.trim() ?? '';
    if (!CODE.test(code))
      throw new CrmValidationError('code must be 1–64 letters, digits, ".", "_" or "-"');
    if (!input.name?.trim()) throw new CrmValidationError('name is required');
    const dup = await this.database.db
      .select({ id: partyGroup.id })
      .from(partyGroup)
      .where(and(eq(partyGroup.groupType, input.groupType), eq(partyGroup.code, code)))
      .limit(1);
    if (dup[0])
      throw new CrmValidationError(`a ${input.groupType} group with code "${code}" already exists`);
    if (input.parentGroupId) await this.mustBeParent(input.parentGroupId, input.groupType);
    const defaultCreditLimit = this.checkCredit(input.groupType, input.defaultCreditLimit);
    const rows = await this.database.db
      .insert(partyGroup)
      .values({
        groupType: input.groupType,
        code,
        name: input.name.trim(),
        parentGroupId: input.parentGroupId ?? null,
        isGroup: input.isGroup ?? false,
        defaultCreditLimit,
      })
      .returning();
    return toRecord(rows[0]!);
  }

  async update(
    id: string,
    input: {
      name?: string;
      parentGroupId?: string | null;
      isGroup?: boolean;
      defaultCreditLimit?: string | null;
    },
  ): Promise<PartyGroupRecord> {
    const g = await this.get(id);
    const set: Partial<typeof partyGroup.$inferInsert> = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new CrmValidationError('name is required');
      set.name = input.name.trim();
    }
    if (input.parentGroupId !== undefined) {
      if (input.parentGroupId !== null) {
        await this.mustBeParent(input.parentGroupId, g.groupType);
        const all = await this.list(g.groupType);
        const parentOf = new Map(all.map((x) => [x.id, x.parentGroupId]));
        for (
          let cur: string | null = input.parentGroupId, n = 0;
          cur && n <= all.length;
          cur = parentOf.get(cur) ?? null, n++
        ) {
          if (cur === id)
            throw new CrmValidationError(`نقل المجموعة ${g.code} هنا هيعمل حلقة في الشجرة`);
        }
      }
      set.parentGroupId = input.parentGroupId;
    }
    if (input.isGroup !== undefined && input.isGroup !== g.isGroup) {
      if (input.isGroup && (await this.members(id, false)).length > 0) {
        throw new CrmValidationError(
          `المجموعة ${g.code} فيها ${g.groupType === 'customer' ? 'عملاء' : 'موردين'} — انقلهم الأول قبل ما تخليها مجموعة أب`,
        );
      }
      if (!input.isGroup && (await this.list(g.groupType)).some((x) => x.parentGroupId === id)) {
        throw new CrmValidationError(`المجموعة ${g.code} تحتها مجموعات فرعية`);
      }
      set.isGroup = input.isGroup;
    }
    if (input.defaultCreditLimit !== undefined)
      set.defaultCreditLimit = this.checkCredit(g.groupType, input.defaultCreditLimit);
    await this.database.db
      .update(partyGroup)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(partyGroup.id, id));
    return this.get(id);
  }

  async assignCustomer(customerId: string, groupId: string | null): Promise<CustomerRecord> {
    if (!(await this.crm.findCustomerById(customerId)))
      throw new CrmNotFoundError(`customer ${customerId} does not exist`);
    if (groupId) await this.mustBeLeaf(groupId, 'customer');
    return this.crm.setCustomerGroup(customerId, groupId);
  }

  async assignSupplier(supplierId: string, groupId: string | null): Promise<SupplierRecord> {
    if (!(await this.crm.findSupplierById(supplierId)))
      throw new CrmNotFoundError(`supplier ${supplierId} does not exist`);
    if (groupId) await this.mustBeLeaf(groupId, 'supplier');
    return this.crm.setSupplierGroup(supplierId, groupId);
  }

  /** Customers or suppliers in the group (and, by default, in every group under it). */
  async members(id: string, withSubgroups = true): Promise<Array<CustomerRecord | SupplierRecord>> {
    const g = await this.get(id);
    const ids = new Set([id]);
    if (withSubgroups) {
      const all = await this.list(g.groupType);
      for (let grew = true; grew;) {
        grew = false;
        for (const x of all)
          if (x.parentGroupId && ids.has(x.parentGroupId) && !ids.has(x.id)) {
            ids.add(x.id);
            grew = true;
          }
      }
    }
    return g.groupType === 'customer'
      ? (await this.crm.listCustomers()).filter(
          (c) => c.customerGroupId && ids.has(c.customerGroupId),
        )
      : (await this.crm.listSuppliers()).filter(
          (s) => s.supplierGroupId && ids.has(s.supplierGroupId),
        );
  }

  /** The customer's own limit, else the nearest group up the tree that sets a default (item 6 + 28). */
  async effectiveCreditLimit(
    c: CustomerRecord,
  ): Promise<{ limit: string | null; source: 'customer' | 'group' | null; groupCode?: string }> {
    if (c.creditLimit !== null) return { limit: c.creditLimit, source: 'customer' };
    if (!c.customerGroupId) return { limit: null, source: null };
    const all = new Map((await this.list('customer')).map((g) => [g.id, g]));
    for (
      let g = all.get(c.customerGroupId), n = 0;
      g && n <= all.size;
      g = g.parentGroupId ? all.get(g.parentGroupId) : undefined, n++
    ) {
      if (g.defaultCreditLimit !== null)
        return { limit: g.defaultCreditLimit, source: 'group', groupCode: g.code };
    }
    return { limit: null, source: null };
  }

  private checkCredit(groupType: PartyGroupType, v: string | null | undefined): string | null {
    if (v === undefined || v === null || v === '') return null;
    if (groupType !== 'customer')
      throw new CrmValidationError('only customer groups carry a default credit limit');
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0)
      throw new CrmValidationError('defaultCreditLimit must be a non-negative number');
    return n.toFixed(4);
  }

  private async mustBeParent(id: string, groupType: PartyGroupType): Promise<PartyGroupRecord> {
    const p = await this.get(id);
    if (p.groupType !== groupType)
      throw new CrmValidationError(`group ${p.code} is a ${p.groupType} group`);
    if (!p.isGroup)
      throw new CrmValidationError(`المجموعة ${p.code} مش مجموعة أب — لازم تتعلّم "مجموعة" الأول`);
    return p;
  }

  private async mustBeLeaf(id: string, groupType: PartyGroupType): Promise<PartyGroupRecord> {
    const g = await this.get(id);
    if (g.groupType !== groupType)
      throw new CrmValidationError(`group ${g.code} is a ${g.groupType} group`);
    if (g.isGroup)
      throw new CrmValidationError(`المجموعة ${g.code} مجموعة أب — اختار مجموعة فرعية من تحتها`);
    return g;
  }
}

function toRecord(r: typeof partyGroup.$inferSelect): PartyGroupRecord {
  return {
    id: r.id,
    groupType: r.groupType as PartyGroupType,
    code: r.code,
    name: r.name,
    parentGroupId: r.parentGroupId,
    isGroup: r.isGroup,
    defaultCreditLimit: r.defaultCreditLimit,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
