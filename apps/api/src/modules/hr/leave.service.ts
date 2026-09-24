import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { OrganizationService } from '../organization/organization.service';
import type { OrgTreeNode } from '../organization/organization.types';
import { HrNotFoundError, HrValidationError } from './hr.errors';
import { HrRepository } from './hr.repository';
import { leaveAllocation, leaveType } from './hr.schema';

export interface LeaveTypeRecord {
  id: string;
  code: string;
  name: string;
  maxDaysPerAllocation: string | null;
}
export interface LeaveAllocationRecord {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  days: string;
  batchReference: string | null;
}
export interface BulkAllocationInput {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  days: string;
  /** Filters (combined with AND). Only ACTIVE employees are ever allocated. */
  orgNodeId?: string;
  role?: string;
  employeeIds?: string[];
}
export interface BulkAllocationResult {
  batchReference: string;
  allocated: Array<{ employeeCode: string; allocationId: string }>;
  skipped: Array<{ employeeCode: string; reason: string }>;
}

/** Leave types and allocations, including bulk allocation by filters (plan item 20). */
@Injectable()
export class LeaveService {
  constructor(
    private readonly database: DatabaseService,
    private readonly employees: HrRepository,
    @Optional() private readonly organization?: OrganizationService,
  ) {}

  async listTypes(): Promise<LeaveTypeRecord[]> {
    const rows = await this.database.db.select().from(leaveType).orderBy(asc(leaveType.code));
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      maxDaysPerAllocation: r.maxDaysPerAllocation,
    }));
  }

  async createType(input: {
    code: string;
    name: string;
    maxDaysPerAllocation?: string;
  }): Promise<LeaveTypeRecord> {
    const code = input.code?.trim();
    if (!code || !input.name?.trim()) throw new HrValidationError('code and name are required');
    const exists = await this.database.db
      .select({ id: leaveType.id })
      .from(leaveType)
      .where(eq(leaveType.code, code))
      .limit(1);
    if (exists.length > 0) throw new HrValidationError(`leave type "${code}" already exists`);
    const rows = await this.database.db
      .insert(leaveType)
      .values({
        code,
        name: input.name.trim(),
        maxDaysPerAllocation: input.maxDaysPerAllocation ?? null,
      })
      .returning();
    const r = rows[0]!;
    return { id: r.id, code: r.code, name: r.name, maxDaysPerAllocation: r.maxDaysPerAllocation };
  }

  async listAllocations(employeeId?: string): Promise<LeaveAllocationRecord[]> {
    const q = this.database.db.select().from(leaveAllocation);
    const rows = employeeId
      ? await q
          .where(eq(leaveAllocation.employeeId, employeeId))
          .orderBy(asc(leaveAllocation.fromDate))
      : await q.orderBy(asc(leaveAllocation.fromDate));
    return rows.map(toAllocation);
  }

  /**
   * Allocates the same leave to every ACTIVE employee matching the filters. Employees that already
   * hold an overlapping allocation of the same type are skipped (with the reason), never doubled.
   */
  async bulkAllocate(input: BulkAllocationInput): Promise<BulkAllocationResult> {
    const type = await this.database.db
      .select()
      .from(leaveType)
      .where(eq(leaveType.id, input.leaveTypeId))
      .limit(1);
    if (!type[0]) throw new HrNotFoundError(`leave type ${input.leaveTypeId} does not exist`);
    const from = new Date(input.fromDate);
    const to = new Date(input.toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from)
      throw new HrValidationError('invalid period');
    const days = Number(input.days);
    if (!(days > 0)) throw new HrValidationError('days must be positive');
    const max = type[0].maxDaysPerAllocation;
    if (max !== null && days > Number(max))
      throw new HrValidationError(
        `${type[0].code} allows at most ${Number(max)} days per allocation`,
      );

    let scope: Set<string> | null = null;
    if (input.orgNodeId) {
      if (!this.organization) throw new HrValidationError('organization filter is not available');
      const root = await this.organization.getSubtree(input.orgNodeId).catch(() => null);
      if (!root) throw new HrNotFoundError(`org node ${input.orgNodeId} does not exist`);
      scope = new Set<string>();
      const walk = (n: OrgTreeNode): void => {
        scope!.add(n.id);
        n.children.forEach(walk);
      };
      walk(root);
    }
    const wanted = input.employeeIds ? new Set(input.employeeIds) : null;
    const targets = (await this.employees.listEmployees()).filter(
      (e) =>
        e.status === 'active' &&
        (!scope || scope.has(e.orgNodeId)) &&
        (!input.role || e.role === input.role) &&
        (!wanted || wanted.has(e.id)),
    );
    if (targets.length === 0) throw new HrValidationError('no active employee matches the filters');

    const batchReference = `LALLOC-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
    const result: BulkAllocationResult = { batchReference, allocated: [], skipped: [] };
    for (const e of targets) {
      const overlap = await this.database.db
        .select({ id: leaveAllocation.id })
        .from(leaveAllocation)
        .where(
          and(
            eq(leaveAllocation.employeeId, e.id),
            eq(leaveAllocation.leaveTypeId, input.leaveTypeId),
            lte(leaveAllocation.fromDate, to),
            gte(leaveAllocation.toDate, from),
          ),
        )
        .limit(1);
      if (overlap.length > 0) {
        result.skipped.push({
          employeeCode: e.code,
          reason: 'لديه تخصيص متداخل لنفس نوع الإجازة في نفس الفترة',
        });
        continue;
      }
      const rows = await this.database.db
        .insert(leaveAllocation)
        .values({
          employeeId: e.id,
          leaveTypeId: input.leaveTypeId,
          fromDate: from,
          toDate: to,
          days: days.toFixed(2),
          batchReference,
        })
        .returning({ id: leaveAllocation.id });
      result.allocated.push({ employeeCode: e.code, allocationId: rows[0]!.id });
    }
    return result;
  }
}

function toAllocation(r: typeof leaveAllocation.$inferSelect): LeaveAllocationRecord {
  return {
    id: r.id,
    employeeId: r.employeeId,
    leaveTypeId: r.leaveTypeId,
    fromDate: r.fromDate.toISOString(),
    toDate: r.toDate.toISOString(),
    days: r.days,
    batchReference: r.batchReference,
  };
}
