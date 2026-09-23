import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { HrNotFoundError, HrValidationError } from './hr.errors';
import { HrRepository } from './hr.repository';
import { finalSettlement, finalSettlementLine, leaveAllocation, payrollEntry } from './hr.schema';

export type SettlementDirection = 'payable' | 'receivable';
export interface SettlementLineInput { direction: SettlementDirection; component: string; description: string; amount: number; isAuto: boolean; }
export interface FinalSettlementRecord {
  id: string; settlementNumber: string; employeeId: string; relievingDate: string; status: 'draft' | 'submitted' | 'cancelled';
  totalPayable: string; totalReceivable: string; netAmount: string; submittedAt: string | null;
  lines: Array<{ id: string; direction: SettlementDirection; component: string; description: string; amount: string; isAuto: boolean }>;
}

const DAY = 86_400_000;

/**
 * Suggested lines for a leaving employee (pure, for testing): unpaid payroll, the prorated salary of
 * the last month when it has no payroll entry, and earned leave (allocated days × elapsed share of
 * the allocation period) encashed at base salary / 30 per day.
 */
export function suggestSettlementLines(
  relieving: Date,
  baseSalary: number,
  unpaidPayroll: Array<{ periodYear: string; periodMonth: string; totalAmount: string }>,
  lastMonthHasPayroll: boolean,
  allocations: Array<{ days: string; fromDate: Date; toDate: Date }>,
): SettlementLineInput[] {
  const lines: SettlementLineInput[] = [];
  for (const p of unpaidPayroll) {
    lines.push({ direction: 'payable', component: 'unpaid_salary', description: `مرتب غير مصروف ${p.periodYear}-${p.periodMonth}`, amount: Number(p.totalAmount), isAuto: true });
  }
  if (!lastMonthHasPayroll && baseSalary > 0) {
    const day = relieving.getUTCDate();
    const daysInMonth = new Date(Date.UTC(relieving.getUTCFullYear(), relieving.getUTCMonth() + 1, 0)).getUTCDate();
    lines.push({ direction: 'payable', component: 'prorated_salary', description: `مرتب نسبي ${day} من ${daysInMonth} يوم`, amount: (baseSalary * day) / daysInMonth, isAuto: true });
  }
  const dailyRate = baseSalary / 30;
  for (const a of allocations) {
    const total = (a.toDate.getTime() - a.fromDate.getTime()) / DAY + 1;
    const elapsed = Math.min(total, Math.max(0, (relieving.getTime() - a.fromDate.getTime()) / DAY + 1));
    const earned = (Number(a.days) * elapsed) / total;
    if (earned > 0 && dailyRate > 0) {
      lines.push({ direction: 'payable', component: 'leave_encashment', description: `بدل رصيد إجازات مستحق ${earned.toFixed(2)} يوم`, amount: earned * dailyRate, isAuto: true });
    }
  }
  return lines.filter((l) => l.amount > 0.00005);
}

/** Full and final settlement on leaving (plan item 21). */
@Injectable()
export class FinalSettlementService {
  constructor(
    private readonly database: DatabaseService,
    private readonly employees: HrRepository,
  ) {}

  async create(employeeId: string): Promise<FinalSettlementRecord> {
    const emp = await this.employees.findEmployeeById(employeeId);
    if (!emp) throw new HrNotFoundError(`employee ${employeeId} does not exist`);
    if (emp.status !== 'terminated' || !emp.relievingDate) {
      throw new HrValidationError(`employee ${emp.code} has not left yet — terminate the service first (it sets the relieving date)`);
    }
    const open = await this.database.db.select({ id: finalSettlement.id }).from(finalSettlement)
      .where(and(eq(finalSettlement.employeeId, employeeId), ne(finalSettlement.status, 'cancelled'))).limit(1);
    if (open.length > 0) throw new HrValidationError(`employee ${emp.code} already has a final settlement`);

    const relieving = new Date(emp.relievingDate);
    const unpaid = await this.database.db.select().from(payrollEntry)
      .where(and(eq(payrollEntry.employeeId, employeeId), inArray(payrollEntry.status, ['draft', 'approved'])));
    const lastMonth = await this.database.db.select({ id: payrollEntry.id }).from(payrollEntry).where(and(
      eq(payrollEntry.employeeId, employeeId),
      eq(payrollEntry.periodYear, String(relieving.getUTCFullYear())),
      eq(payrollEntry.periodMonth, String(relieving.getUTCMonth() + 1).padStart(2, '0')),
    )).limit(1);
    const allocations = await this.database.db.select().from(leaveAllocation).where(and(
      eq(leaveAllocation.employeeId, employeeId), lte(leaveAllocation.fromDate, relieving), gte(leaveAllocation.toDate, relieving),
    ));
    const lines = suggestSettlementLines(relieving, Number(emp.baseSalary), unpaid, lastMonth.length > 0, allocations);

    const n = Number((await this.database.db.select({ n: count() }).from(finalSettlement))[0]?.n ?? 0) + 1;
    const rows = await this.database.db.insert(finalSettlement).values({
      settlementNumber: `FNF-${relieving.getUTCFullYear()}-${String(n).padStart(6, '0')}`, employeeId, relievingDate: relieving,
    }).returning({ id: finalSettlement.id });
    const id = rows[0]!.id;
    if (lines.length > 0) {
      await this.database.db.insert(finalSettlementLine).values(lines.map((l) => ({ ...l, settlementId: id, amount: l.amount.toFixed(4) })));
    }
    return this.recalculate(id);
  }

  async get(id: string): Promise<FinalSettlementRecord> {
    const rows = await this.database.db.select().from(finalSettlement).where(eq(finalSettlement.id, id)).limit(1);
    const s = rows[0];
    if (!s) throw new HrNotFoundError(`final settlement ${id} does not exist`);
    const lines = await this.database.db.select().from(finalSettlementLine).where(eq(finalSettlementLine.settlementId, id)).orderBy(asc(finalSettlementLine.direction));
    return {
      id: s.id, settlementNumber: s.settlementNumber, employeeId: s.employeeId, relievingDate: s.relievingDate.toISOString(),
      status: s.status as FinalSettlementRecord['status'], totalPayable: s.totalPayable, totalReceivable: s.totalReceivable,
      netAmount: s.netAmount, submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      lines: lines.map((l) => ({ id: l.id, direction: l.direction as SettlementDirection, component: l.component, description: l.description, amount: l.amount, isAuto: l.isAuto })),
    };
  }

  async addLine(id: string, line: { direction: SettlementDirection; component: string; description: string; amount: string }): Promise<FinalSettlementRecord> {
    await this.assertDraft(id);
    const amount = Number(line.amount);
    if (!(amount > 0)) throw new HrValidationError('amount must be positive');
    if (!line.description?.trim() || !line.component?.trim()) throw new HrValidationError('component and description are required');
    await this.database.db.insert(finalSettlementLine).values({
      settlementId: id, direction: line.direction, component: line.component.trim(), description: line.description.trim(), amount: amount.toFixed(4),
    });
    return this.recalculate(id);
  }

  async removeLine(id: string, lineId: string): Promise<FinalSettlementRecord> {
    await this.assertDraft(id);
    await this.database.db.delete(finalSettlementLine).where(and(eq(finalSettlementLine.id, lineId), eq(finalSettlementLine.settlementId, id)));
    return this.recalculate(id);
  }

  async submit(id: string): Promise<FinalSettlementRecord> {
    await this.assertDraft(id);
    await this.database.db.update(finalSettlement).set({ status: 'submitted', submittedAt: new Date() }).where(eq(finalSettlement.id, id));
    return this.get(id);
  }

  async cancel(id: string): Promise<FinalSettlementRecord> {
    await this.assertDraft(id);
    await this.database.db.update(finalSettlement).set({ status: 'cancelled' }).where(eq(finalSettlement.id, id));
    return this.get(id);
  }

  private async assertDraft(id: string): Promise<void> {
    const s = await this.get(id);
    if (s.status !== 'draft') throw new HrValidationError(`final settlement ${s.settlementNumber} is "${s.status}" and can no longer change`);
  }

  private async recalculate(id: string): Promise<FinalSettlementRecord> {
    const lines = await this.database.db.select().from(finalSettlementLine).where(eq(finalSettlementLine.settlementId, id));
    const sum = (d: SettlementDirection): number => lines.filter((l) => l.direction === d).reduce((a, l) => a + Number(l.amount), 0);
    const payable = sum('payable');
    const receivable = sum('receivable');
    await this.database.db.update(finalSettlement).set({
      totalPayable: payable.toFixed(4), totalReceivable: receivable.toFixed(4), netAmount: (payable - receivable).toFixed(4),
    }).where(eq(finalSettlement.id, id));
    return this.get(id);
  }
}
