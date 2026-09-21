// ============================================================
// Motion ERP — Accruals, Prepaids & Provisions DTOs
// Step 64
// ============================================================
import { IsUUID, IsString, IsDateString, IsNumber, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ── Accrual DTOs ─────────────────────────────
export class CreateAccrualDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   fiscalYearId!: string;
  @IsUUID()   periodId!: string;
  @IsDateString() accrualDate!: string;
  @IsString() description!: string;
  @IsUUID()   expenseAccountId!: string;
  @IsUUID()   liabilityAccountId!: string;
  @IsOptional() @IsUUID() costCenterId?: string;
  @IsNumber() @Min(0.01) amount!: number;
}

export class PostAccrualDto {
  @IsUUID() id!: string;
}

export class ReverseAccrualDto {
  @IsUUID() id!: string;
  @IsString() reason!: string;
}

// ── Prepaid DTOs ─────────────────────────────
export class CreatePrepaidDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   fiscalYearId!: string;
  @IsUUID()   periodId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsString() description!: string;
  @IsUUID()   prepaidAccountId!: string;
  @IsUUID()   expenseAccountId!: string;
  @IsOptional() @IsUUID() costCenterId?: string;
  @IsNumber() @Min(0.01) totalAmount!: number;
  @IsInt()    @Min(1) monthsCount!: number;
}

export class AmortizePrepaidDto {
  @IsUUID() id!: string;
  @IsUUID() periodId!: string;
}

// ── Provision DTOs ───────────────────────────
export enum ProvisionType {
  WARRANTY  = 'warranty',
  BAD_DEBT  = 'bad_debt',
  LEGAL     = 'legal',
  OTHER     = 'other',
}

export class CreateProvisionDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   fiscalYearId!: string;
  @IsUUID()   periodId!: string;
  @IsDateString() provisionDate!: string;
  @IsEnum(ProvisionType) provisionType!: ProvisionType;
  @IsString() description!: string;
  @IsUUID()   expenseAccountId!: string;
  @IsUUID()   provisionAccountId!: string;
  @IsOptional() @IsUUID() costCenterId?: string;
  @IsNumber() @Min(0) baseAmount!: number;
  @IsNumber() @Min(0.01) ratePercentage!: number;
  @IsOptional() @IsUUID() relatedInvoiceId?: string;
  @IsOptional() @IsInt() @Min(1) warrantyMonths?: number;
}

export class PostProvisionDto {
  @IsUUID() id!: string;
}

export class UtilizeProvisionDto {
  @IsUUID() id!: string;
  @IsNumber() @Min(0.01) utilizedAmount!: number;
  @IsString() description!: string;
}

// ── Query DTOs ───────────────────────────────
export class QueryAccrualsDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() periodId?: string;
  @IsOptional() @IsString() status?: string;
}

export class QueryPrepaidsDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsString() status?: string;
}

export class QueryProvisionsDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsString() provisionType?: string;
  @IsOptional() @IsString() status?: string;
}