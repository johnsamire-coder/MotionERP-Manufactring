// ============================================================
// Motion ERP — Sales Serial Link DTOs
// Step 69
// ============================================================
import { IsUUID, IsString, IsDateString, IsNumber, IsOptional, IsEnum, Min, IsArray, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

// ── Serial Device Line DTO ───────────────────
export class SerialDeviceLineDto {
  @IsString()  serialNumber!: string;
  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsInt() @Min(1) warrantyMonths?: number;
  @IsOptional() @IsString() hospitalDepartment?: string;
}

// ── Allocate Serials to Sales Invoice ────────
export class AllocateSalesSerialsDto {
  @IsUUID()   salesInvoiceId!: string;
  @IsUUID()   salesInvoiceLineId!: string;
  @IsOptional() @IsUUID() deliveryNoteId?: string;
  @IsUUID()   customerId!: string;
  @IsUUID()   itemId!: string;
  @IsArray()  @ValidateNested({ each: true })
  @Type(() => SerialDeviceLineDto)
  devices!: SerialDeviceLineDto[];
}

// ── Complete Installation & Activate Warranty
export class ActivateWarrantyInstallationDto {
  @IsUUID()   serialLinkId!: string;
  @IsDateString() installationDate!: string;
  @IsString() installedBy!: string;
  @IsOptional() @IsString() hospitalDepartment?: string;
  @IsOptional() @IsString() notes?: string;
}

// ── Query DTOs ───────────────────────────────
export class QuerySalesSerialsDto {
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() salesInvoiceId?: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() status?: string;
}

// ── Serial Device Trace History ──────────────
export class TraceMedicalSerialDto {
  @IsString() serialNumber!: string;
}