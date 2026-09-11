import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { HrNotFoundError, HrValidationError } from './hr.errors';
import { HrRepository } from './hr.repository';
import type {
  CommissionEntryRecord, CommissionRuleRecord, CreateCommissionRuleInput, CreateEmployeeInput,
  CreateExternalCommissionInput, EmployeeRecord, ExternalCommissionRecord, PayrollEntryRecord,
} from './hr.types';

@Injectable()
export class HrService {
  constructor(private readonly repository: HrRepository) {}

  async getEmployees(): Promise<EmployeeRecord[]> { return this.repository.listEmployees(); }

  async createEmployee(input: CreateEmployeeInput): Promise<EmployeeRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findEmployeeByCode(code);
    if (existing) throw new HrValidationError(`an employee with code "${code}" already exists`);
    return this.repository.insertEmployee({ id: randomUUID(), code, name, role: input.role, orgNodeId: input.orgNodeId, baseSalary: input.baseSalary });
  }

  async getCommissionRules(employeeId?: string): Promise<CommissionRuleRecord[]> { return this.repository.listCommissionRules(employeeId); }

  async createCommissionRule(input: CreateCommissionRuleInput): Promise<CommissionRuleRecord> {
    const employee = await this.repository.findEmployeeById(input.employeeId);
    if (!employee) throw new HrNotFoundError(`employee ${input.employeeId} does not exist`);
    const rate = Number(input.ratePercentage);
    if (!Number.isFinite(rate) || rate <= 0) throw new HrValidationError('ratePercentage must be positive');
    return this.repository.insertCommissionRule({ id: randomUUID(), ...input });
  }

  async getCommissionEntries(employeeId?: string): Promise<CommissionEntryRecord[]> { return this.repository.listCommissionEntries(employeeId); }

  /**
   * Called externally (by whoever orchestrates the sale/collection event —
   * this unit has no direct FK to sales/finance, D2/D20) whenever a
   * qualifying event happens. `basisAmount` is the sale value or the
   * collected amount, decided by the CALLER according to which basis the
   * rule uses — this service does not reach into other units itself, it
   * just receives the amount already resolved and applies the employee's
   * active rule to it.
   */
  async earnCommission(employeeId: string, jobOrderReference: string, sourceReference: string, basisAmount: string): Promise<CommissionEntryRecord> {
    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) throw new HrNotFoundError(`employee ${employeeId} does not exist`);

    const rule = await this.repository.findActiveRuleForEmployee(employeeId);
    if (!rule) throw new HrValidationError(`employee ${employeeId} has no active commission rule`);

    const base = Number(basisAmount);
    if (!Number.isFinite(base) || base <= 0) throw new HrValidationError('basisAmount must be positive');

    const commissionAmount = (base * Number(rule.ratePercentage) / 100).toFixed(4);

    return this.repository.insertCommissionEntry({
      id: randomUUID(), employeeId, jobOrderReference, sourceReference, baseAmount: basisAmount, commissionAmount,
    });
  }

  async getExternalCommissions(): Promise<ExternalCommissionRecord[]> { return this.repository.listExternalCommissions(); }

  async createExternalCommission(input: CreateExternalCommissionInput): Promise<ExternalCommissionRecord> {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new HrValidationError('amount must be positive');
    if (!input.beneficiaryName?.trim()) throw new HrValidationError('beneficiaryName is required');
    if (!input.basisDescription?.trim()) throw new HrValidationError('basisDescription is required');
    return this.repository.insertExternalCommission({ id: randomUUID(), ...input });
  }

  async getPayrollEntries(employeeId?: string): Promise<PayrollEntryRecord[]> { return this.repository.listPayrollEntries(employeeId); }

  /**
   * Generates a payroll entry for an employee for a given period: base
   * salary + sum of all still-PENDING commission entries (regardless of
   * which job order they came from), then marks those commissions as 'paid'
   * so they are never counted twice in a future payroll run. This is the
   * explicit "commission must appear as a clear line in the employee's
   * salary" link the owner required.
   */
  async generatePayroll(employeeId: string, periodYear: string, periodMonth: string): Promise<PayrollEntryRecord> {
    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) throw new HrNotFoundError(`employee ${employeeId} does not exist`);

    const existing = await this.repository.findPayrollEntry(employeeId, periodYear, periodMonth);
    if (existing) throw new HrValidationError(`payroll for employee ${employeeId} in ${periodYear}-${periodMonth} already exists`);

    const pendingCommissions = await this.repository.listPendingCommissionsForPeriod(employeeId);
    const totalCommissions = pendingCommissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
    const totalAmount = Number(employee.baseSalary) + totalCommissions;

    const entry = await this.repository.insertPayrollEntry({
      id: randomUUID(), employeeId, periodYear, periodMonth,
      baseSalary: employee.baseSalary, totalCommissions: totalCommissions.toFixed(4), totalAmount: totalAmount.toFixed(4),
    });

    if (pendingCommissions.length > 0) await this.repository.markCommissionsPaid(employeeId);

    return entry;
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new HrValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) throw new HrValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  return trimmed;
}
function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new HrValidationError('name is required');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new HrValidationError('name must not be blank');
  return trimmed;
}
