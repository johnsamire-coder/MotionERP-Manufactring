// ============================================================
// Motion ERP — Egyptian Tax Authority & Customs DTOs
// Step 79 | Complete Verified Exports
// ============================================================
import {
  IsUUID,
  IsString,
  IsDateString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';

// ── 1. VAT Settlement DTOs ───────────────────
export class CreateTaxSettlementDto {
  @IsUUID() companyId!: string;
  @IsUUID() fiscalYearId!: string;
  @IsUUID() periodId!: string;
  @IsString() taxPeriod!: string; // "2026-08"
  @IsNumber() @Min(0) totalSalesTaxable!: number;
  @IsNumber() @Min(0) outputVatAmount!: number;
  @IsNumber() @Min(0) totalPurchaseTaxable!: number;
  @IsNumber() @Min(0) inputVatAmount!: number;
}

export class SettleAndPayVatDto {
  @IsUUID() settlementId!: string;
  @IsDateString() paymentDate!: string;
  @IsString() paymentReference!: string;
  @IsUUID() bankAccountId!: string;
}

// ── 2. Withholding Tax (Form 41) DTOs ────────
export enum WhtDirection {
  DEDUCTED_BY_US = 'deducted_by_us',
  DEDUCTED_FROM_US = 'deducted_from_us',
}

export class CreateWhtEntryDto {
  @IsUUID() companyId!: string;
  @IsUUID() fiscalYearId!: string;
  @IsInt() @Min(1) @Max(4) quarter!: number;
  @IsDateString() entryDate!: string;
  @IsEnum(WhtDirection) direction!: WhtDirection;
  @IsUUID() partnerId!: string;
  @IsString() partnerName!: string;
  @IsString() taxRegistrationNum!: string;
  @IsOptional() @IsUUID() invoiceId?: string;
  @IsString() invoiceNumber!: string;
  @IsNumber() @Min(0.01) baseAmount!: number;
  @IsNumber() @Min(0.1) @Max(100) whtRate!: number; // 1% or 3%
}

export class DeclareForm41QuarterDto {
  @IsUUID() companyId!: string;
  @IsInt() @Min(1) @Max(4) quarter!: number;
  @IsString() year!: string;
}

// ── 3. Customs Declaration DTOs ──────────────
export class CreateCustomsDeclarationDto {
  @IsUUID() companyId!: string;
  @IsUUID() fiscalYearId!: string;
  @IsUUID() periodId!: string;
  @IsString() declarationNumber!: string; // رقم الإفراج 46 ك.م
  @IsDateString() declarationDate!: string;
  @IsString() portName!: string;
  @IsString() billOfLading!: string;
  @IsString() supplierName!: string;
  @IsOptional() @IsString() currency?: string;
  @IsNumber() @Min(0.0001) exchangeRate!: number;
  @IsNumber() @Min(0.01) cifValueForeign!: number;
  @IsNumber() @Min(0) customsDutyAmount!: number;
  @IsOptional() @IsNumber() @Min(0) developmentFee?: number;
  @IsNumber() @Min(0) vatPaidAtCustoms!: number;
  @IsOptional() @IsNumber() @Min(0) clearanceExpenses?: number;
}

export class CapitalizeCustomsCostDto {
  @IsUUID() declarationId!: string;
  @IsUUID() targetWarehouseId!: string;
}

// ── Query DTOs ───────────────────────────────
export class QueryTaxSettlementsDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsString() taxPeriod?: string;
  @IsOptional() @IsString() status?: string;
}

export class QueryWhtEntriesDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsInt() quarter?: number;
  @IsOptional() @IsString() direction?: string;
  @IsOptional() @IsString() status?: string;
}

export class QueryCustomsDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsString() declarationNumber?: string;
  @IsOptional() @IsString() status?: string;
}
