// ============================================================
// Motion ERP — Period & Fiscal Year Closing DTOs
// Step 90
// ============================================================
import { IsUUID, IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class ClosePeriodDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   fiscalYearId!: string;
  @IsUUID()   periodId!: string;
  @IsString() periodName!: string; // e.g. "أغسطس 2026"
  @IsOptional() @IsString() closingNotes?: string;
  @IsOptional() @IsBoolean() forceBypassWarnings?: boolean;
}

export class ReopenPeriodDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   periodId!: string;
  @IsString() reason!: string;
  @IsString() supervisorApprovalCode!: string;
}

export class QueryPeriodStatusDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() fiscalYearId?: string;
}