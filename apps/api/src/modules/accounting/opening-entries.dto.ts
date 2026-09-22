// ============================================================
// Motion ERP — Opening Entries DTOs
// Step 92 | Balance Roll-forward & Initial Setup
// ============================================================
import { IsUUID, IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OpeningEntryLineDto {
  @IsUUID()   accountId!: string;
  @IsString() accountName!: string;
  @IsNumber() @Min(0) debit!: number;
  @IsNumber() @Min(0) credit!: number;
  @IsOptional() @IsString() description?: string;
}

export class RollForwardOpeningEntryDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   sourceFiscalYearId!: string; // السنة المغلقة
  @IsUUID()   targetFiscalYearId!: string; // السنة الجديدة
  @IsUUID()   targetPeriodId!: string;     // شهر يناير في السنة الجديدة
  @IsDateString() openingDate!: string;    // "2027-01-01"
  @IsOptional() @IsString() notes?: string;
}

export class ManualOpeningEntryDto {
  @IsUUID()   companyId!: string;
  @IsUUID()   fiscalYearId!: string;
  @IsUUID()   periodId!: string;
  @IsDateString() openingDate!: string;
  @IsString() description!: string;
  @IsArray()  @ValidateNested({ each: true })
  @Type(() => OpeningEntryLineDto)
  lines!: OpeningEntryLineDto[];
}