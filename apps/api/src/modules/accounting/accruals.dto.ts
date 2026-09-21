// ============================================================
// Motion ERP — Accrual, Prepaid & Provision DTOs (Updated)
// Step 77
// ============================================================
import { IsUUID, IsString, IsDateString, IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';

// ── Accrued Expense DTOs ─────────────────────
export class CreateAccrualDto {
  @IsUUID()   orgNodeId!: string;
  @IsUUID()   expenseAccountId!: string;
  @IsUUID()   accruedLiabilityAccountId!: string;
  @IsDateString() accrualDate!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() description!: string;
  @IsOptional() @IsString() notes?: string;
}

export class PostAccrualDto {
  @IsUUID() id!: string;
}

export class ReverseAccrualDto {
  @IsUUID() id!: string;
  @IsDateString() reversalDate!: string;
}

// ── Prepaid Expense DTOs ─────────────────────
export class CreatePrepaidDto {
  @IsUUID()   orgNodeId!: string;
  @IsUUID()   prepaidAssetAccountId!: string;
  @IsUUID()   expenseAccountId!: string;
  @IsDateString() paymentDate!: string;
  @IsDateString() coverageStartDate!: string;
  @IsDateString() coverageEndDate!: string;
  @IsNumber() @Min(0.01) totalAmount!: number;
  @IsNumber() @Min(0.01) monthlyAmortization!: number;
  @IsString() description!: string;
  @IsOptional() @IsString() notes?: string;
}

export class AmortizePrepaidDto {
  @IsUUID() id!: string;
  @IsNumber() @Min(0.01) amount!: number;
}

// ── Warranty Provision DTOs ──────────────────
export class CreateWarrantyProvisionDto {
  @IsUUID()   orgNodeId!: string;
  @IsUUID()   warrantyExpenseAccountId!: string;
  @IsUUID()   provisionLiabilityAccountId!: string;
  @IsDateString() provisionDate!: string;
  @IsOptional() @IsUUID() salesInvoiceId?: string;
  @IsNumber() @Min(0.01) baseAmount!: number;
  @IsNumber() @Min(0.01) @Max(100) provisionRate!: number;
  @IsOptional() @IsDateString() warrantyExpiryDate?: string;
  @IsString() description!: string;
  @IsOptional() @IsString() notes?: string;
}

export class UtilizeProvisionDto {
  @IsUUID() id!: string;
  @IsNumber() @Min(0.01) amount!: number;
}