// ============================================================
// Motion ERP — Fiscal Year Closing DTOs
// Step 91
// ============================================================
import { IsUUID, IsString, IsDateString, IsOptional, IsNumber } from 'class-validator';

export class PreviewFiscalYearClosingDto {
  @IsUUID() companyId!: string;
  @IsUUID() fiscalYearId!: string;
}

export class CloseFiscalYearDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   fiscalYearId!: string;
  @IsDateString() closingDate!: string; // e.g. "2026-12-31"
  @IsUUID()   retainedEarningsAccountId!: string; // حساب الأرباح المرحلة (Equity)
  @IsOptional() @IsString() closingNotes?: string;
}