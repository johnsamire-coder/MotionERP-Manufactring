export type EmployeeStatus = 'active' | 'inactive' | 'terminated';
export type CommissionBasis = 'sale_value' | 'collected_amount';
export type CommissionRuleStatus = 'active' | 'inactive';
export type CommissionEntryStatus = 'pending' | 'paid';
export type ExternalCommissionStatus = 'pending' | 'paid' | 'cancelled';
export type PayrollEntryStatus = 'draft' | 'approved' | 'paid';

export interface EmployeeRecord {
  id: string; code: string; name: string; role: string; orgNodeId: string; baseSalary: string; status: EmployeeStatus;
}
export interface CreateEmployeeInput { code: string; name: string; role: string; orgNodeId: string; baseSalary?: string; }

export interface CommissionRuleRecord {
  id: string; employeeId: string; basis: CommissionBasis; ratePercentage: string; status: CommissionRuleStatus;
}
export interface CreateCommissionRuleInput { employeeId: string; basis: CommissionBasis; ratePercentage: string; }

export interface CommissionEntryRecord {
  id: string; employeeId: string; jobOrderReference: string; sourceReference: string;
  baseAmount: string; commissionAmount: string; earnedDate: string; status: CommissionEntryStatus;
}

export interface ExternalCommissionRecord {
  id: string; beneficiaryName: string; jobOrderReference: string; amount: string;
  basisDescription: string; dueDate: string | null; status: ExternalCommissionStatus;
}
export interface CreateExternalCommissionInput {
  beneficiaryName: string; jobOrderReference: string; amount: string; basisDescription: string; dueDate?: string;
}

export interface PayrollEntryRecord {
  id: string; employeeId: string; periodYear: string; periodMonth: string;
  baseSalary: string; totalCommissions: string; totalAmount: string; status: PayrollEntryStatus;
}
