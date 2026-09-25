// ============================================================
// Motion ERP — Purchase Batch Link DTOs
// Step 68
// ============================================================
import {
  IsUUID,
  IsString,
  IsDateString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Batch Line DTO ───────────────────────────
export class BatchLineDto {
  @IsString() batchNumber!: string;
  @IsNumber() @Min(0.01) receivedQty!: number;
  @IsOptional() @IsDateString() manufacturingDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() supplierBatchRef?: string;
  @IsOptional() @IsString() certificateNumber?: string;
}

// ── Register Batches for Purchase Invoice ────
export class RegisterPurchaseBatchesDto {
  @IsUUID() purchaseInvoiceId!: string;
  @IsUUID() purchaseInvoiceLineId!: string;
  @IsUUID() itemId!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchLineDto)
  batches!: BatchLineDto[];
}

// ── Update Batch Quarantine Status ───────────
export enum QuarantineAction {
  ACCEPT = 'accepted',
  REJECT = 'rejected',
  QUARANTINE = 'quarantined',
}

export class UpdateBatchStatusDto {
  @IsUUID() batchLinkId!: string;
  @IsEnum(QuarantineAction) action!: QuarantineAction;
  @IsOptional() @IsNumber() @Min(0) acceptedQty?: number;
  @IsOptional() @IsNumber() @Min(0) rejectedQty?: number;
  @IsOptional() @IsUUID() inspectionId?: string;
  @IsOptional() @IsString() reason?: string;
}

// ── Query DTOs ───────────────────────────────
export class QueryPurchaseBatchesDto {
  @IsOptional() @IsUUID() purchaseInvoiceId?: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsString() quarantineStatus?: string;
}

// ── Traceability Search DTO ──────────────────
export class TraceabilitySearchDto {
  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
}
