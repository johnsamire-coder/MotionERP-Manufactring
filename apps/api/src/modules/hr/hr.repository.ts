import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { commissionEntry, commissionRule, employee, externalCommission, payrollEntry } from './hr.schema';
import type {
  CommissionBasis, CommissionEntryRecord, CommissionEntryStatus, CommissionRuleRecord, CommissionRuleStatus,
  CreateCommissionRuleInput, CreateEmployeeInput, CreateExternalCommissionInput, EmployeeRecord, EmployeeStatus,
  ExternalCommissionRecord, ExternalCommissionStatus, PayrollEntryRecord, PayrollEntryStatus,
} from './hr.types';

const empColumns = { id: employee.id, code: employee.code, name: employee.name, role: employee.role, orgNodeId: employee.orgNodeId, baseSalary: employee.baseSalary, status: employee.status };
const ruleColumns = { id: commissionRule.id, employeeId: commissionRule.employeeId, basis: commissionRule.basis, ratePercentage: commissionRule.ratePercentage, status: commissionRule.status };
const entryColumns = {
  id: commissionEntry.id, employeeId: commissionEntry.employeeId, jobOrderReference: commissionEntry.jobOrderReference,
  sourceReference: commissionEntry.sourceReference, baseAmount: commissionEntry.baseAmount,
  commissionAmount: commissionEntry.commissionAmount, earnedDate: commissionEntry.earnedDate, status: commissionEntry.status,
};
const extColumns = {
  id: externalCommission.id, beneficiaryName: externalCommission.beneficiaryName, jobOrderReference: externalCommission.jobOrderReference,
  amount: externalCommission.amount, basisDescription: externalCommission.basisDescription, dueDate: externalCommission.dueDate, status: externalCommission.status,
};
const payColumns = {
  id: payrollEntry.id, employeeId: payrollEntry.employeeId, periodYear: payrollEntry.periodYear, periodMonth: payrollEntry.periodMonth,
  baseSalary: payrollEntry.baseSalary, totalCommissions: payrollEntry.totalCommissions, totalAmount: payrollEntry.totalAmount, status: payrollEntry.status,
};

interface EmpRow { id: string; code: string; name: string; role: string; orgNodeId: string; baseSalary: string; status: string; }
interface RuleRow { id: string; employeeId: string; basis: string; ratePercentage: string; status: string; }
interface EntryRow { id: string; employeeId: string; jobOrderReference: string; sourceReference: string; baseAmount: string; commissionAmount: string; earnedDate: Date; status: string; }
interface ExtRow { id: string; beneficiaryName: string; jobOrderReference: string; amount: string; basisDescription: string; dueDate: Date | null; status: string; }
interface PayRow { id: string; employeeId: string; periodYear: string; periodMonth: string; baseSalary: string; totalCommissions: string; totalAmount: string; status: string; }

function toEmpRecord(row: EmpRow): EmployeeRecord { return { id: row.id, code: row.code, name: row.name, role: row.role, orgNodeId: row.orgNodeId, baseSalary: row.baseSalary, status: row.status as EmployeeStatus }; }
function toRuleRecord(row: RuleRow): CommissionRuleRecord { return { id: row.id, employeeId: row.employeeId, basis: row.basis as CommissionBasis, ratePercentage: row.ratePercentage, status: row.status as CommissionRuleStatus }; }
function toEntryRecord(row: EntryRow): CommissionEntryRecord {
  return { id: row.id, employeeId: row.employeeId, jobOrderReference: row.jobOrderReference, sourceReference: row.sourceReference,
    baseAmount: row.baseAmount, commissionAmount: row.commissionAmount, earnedDate: row.earnedDate.toISOString(), status: row.status as CommissionEntryStatus };
}
function toExtRecord(row: ExtRow): ExternalCommissionRecord {
  return { id: row.id, beneficiaryName: row.beneficiaryName, jobOrderReference: row.jobOrderReference, amount: row.amount,
    basisDescription: row.basisDescription, dueDate: row.dueDate ? row.dueDate.toISOString() : null, status: row.status as ExternalCommissionStatus };
}
function toPayRecord(row: PayRow): PayrollEntryRecord {
  return { id: row.id, employeeId: row.employeeId, periodYear: row.periodYear, periodMonth: row.periodMonth,
    baseSalary: row.baseSalary, totalCommissions: row.totalCommissions, totalAmount: row.totalAmount, status: row.status as PayrollEntryStatus };
}

@Injectable()
export class HrRepository {
  constructor(private readonly database: DatabaseService) {}

  async listEmployees(): Promise<EmployeeRecord[]> {
    const rows = await this.database.db.select(empColumns).from(employee).orderBy(asc(employee.code));
    return rows.map(toEmpRecord);
  }
  async findEmployeeById(id: string): Promise<EmployeeRecord | null> {
    const rows = await this.database.db.select(empColumns).from(employee).where(eq(employee.id, id)).limit(1);
    return rows[0] ? toEmpRecord(rows[0]) : null;
  }
  async findEmployeeByCode(code: string): Promise<EmployeeRecord | null> {
    const rows = await this.database.db.select(empColumns).from(employee).where(eq(employee.code, code)).limit(1);
    return rows[0] ? toEmpRecord(rows[0]) : null;
  }
  async insertEmployee(input: CreateEmployeeInput & { id: string }): Promise<EmployeeRecord> {
    const rows = await this.database.db.insert(employee).values({
      id: input.id, code: input.code, name: input.name, role: input.role, orgNodeId: input.orgNodeId, baseSalary: input.baseSalary ?? '0',
    }).returning(empColumns);
    return toEmpRecord(rows[0]!);
  }

  async listCommissionRules(employeeId?: string): Promise<CommissionRuleRecord[]> {
    const rows = employeeId
      ? await this.database.db.select(ruleColumns).from(commissionRule).where(eq(commissionRule.employeeId, employeeId))
      : await this.database.db.select(ruleColumns).from(commissionRule);
    return rows.map(toRuleRecord);
  }
  async findActiveRuleForEmployee(employeeId: string): Promise<CommissionRuleRecord | null> {
    const rows = await this.database.db.select(ruleColumns).from(commissionRule)
      .where(and(eq(commissionRule.employeeId, employeeId), eq(commissionRule.status, 'active'))).limit(1);
    return rows[0] ? toRuleRecord(rows[0]) : null;
  }
  async insertCommissionRule(input: CreateCommissionRuleInput & { id: string }): Promise<CommissionRuleRecord> {
    const rows = await this.database.db.insert(commissionRule).values(input).returning(ruleColumns);
    return toRuleRecord(rows[0]!);
  }

  async listCommissionEntries(employeeId?: string): Promise<CommissionEntryRecord[]> {
    const rows = employeeId
      ? await this.database.db.select(entryColumns).from(commissionEntry).where(eq(commissionEntry.employeeId, employeeId)).orderBy(asc(commissionEntry.earnedDate))
      : await this.database.db.select(entryColumns).from(commissionEntry).orderBy(asc(commissionEntry.earnedDate));
    return rows.map(toEntryRecord);
  }
  async insertCommissionEntry(input: { id: string; employeeId: string; jobOrderReference: string; sourceReference: string; baseAmount: string; commissionAmount: string }): Promise<CommissionEntryRecord> {
    const rows = await this.database.db.insert(commissionEntry).values(input).returning(entryColumns);
    return toEntryRecord(rows[0]!);
  }
  async listPendingCommissionsForPeriod(employeeId: string): Promise<CommissionEntryRecord[]> {
    const rows = await this.database.db.select(entryColumns).from(commissionEntry)
      .where(and(eq(commissionEntry.employeeId, employeeId), eq(commissionEntry.status, 'pending')));
    return rows.map(toEntryRecord);
  }
  async markCommissionsPaid(employeeId: string): Promise<void> {
    await this.database.db.update(commissionEntry).set({ status: 'paid' })
      .where(and(eq(commissionEntry.employeeId, employeeId), eq(commissionEntry.status, 'pending')));
  }

  async listExternalCommissions(): Promise<ExternalCommissionRecord[]> {
    const rows = await this.database.db.select(extColumns).from(externalCommission);
    return rows.map(toExtRecord);
  }
  async insertExternalCommission(input: CreateExternalCommissionInput & { id: string }): Promise<ExternalCommissionRecord> {
    const rows = await this.database.db.insert(externalCommission).values({
      id: input.id, beneficiaryName: input.beneficiaryName, jobOrderReference: input.jobOrderReference,
      amount: input.amount, basisDescription: input.basisDescription, dueDate: input.dueDate ? new Date(input.dueDate) : null,
    }).returning(extColumns);
    return toExtRecord(rows[0]!);
  }

  async listPayrollEntries(employeeId?: string): Promise<PayrollEntryRecord[]> {
    const rows = employeeId
      ? await this.database.db.select(payColumns).from(payrollEntry).where(eq(payrollEntry.employeeId, employeeId))
      : await this.database.db.select(payColumns).from(payrollEntry);
    return rows.map(toPayRecord);
  }
  async findPayrollEntry(employeeId: string, year: string, month: string): Promise<PayrollEntryRecord | null> {
    const rows = await this.database.db.select(payColumns).from(payrollEntry)
      .where(and(eq(payrollEntry.employeeId, employeeId), eq(payrollEntry.periodYear, year), eq(payrollEntry.periodMonth, month))).limit(1);
    return rows[0] ? toPayRecord(rows[0]) : null;
  }
  async insertPayrollEntry(input: { id: string; employeeId: string; periodYear: string; periodMonth: string; baseSalary: string; totalCommissions: string; totalAmount: string }): Promise<PayrollEntryRecord> {
    const rows = await this.database.db.insert(payrollEntry).values(input).returning(payColumns);
    return toPayRecord(rows[0]!);
  }
}
