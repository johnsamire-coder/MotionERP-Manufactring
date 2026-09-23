import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const MOVEMENT_TYPES = ['receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment'] as const;
const MOVEMENT_PURPOSES = ['general', 'material_transfer_for_manufacture', 'manufacture_consumption'] as const;
const BATCH_STATUSES = ['active', 'expired', 'quarantined', 'recalled'] as const;
const SERIAL_STATUSES = ['active', 'delivered', 'under_maintenance', 'decommissioned'] as const;
const DISTRIBUTE_METHODS = ['by_amount', 'by_quantity'] as const;

export class CreateWarehouseDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
  @MaxLength(64)
  @IsString()
  code!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsUUID()
  orgNodeId!: string;
}

export class CreateMovementDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsIn(MOVEMENT_TYPES)
  movementType!: (typeof MOVEMENT_TYPES)[number];

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsString()
  movementDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  serialNos?: string[];

  @IsOptional()
  @IsIn(MOVEMENT_PURPOSES)
  purpose?: (typeof MOVEMENT_PURPOSES)[number];

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsBoolean()
  allowBackdate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  backdateReason?: string;
}

export class TransferStockDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  fromWarehouseId!: string;

  @IsUUID()
  toWarehouseId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsIn(MOVEMENT_PURPOSES)
  purpose?: (typeof MOVEMENT_PURPOSES)[number];

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  serialNos?: string[];

  @IsOptional()
  @IsString()
  movementDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;
}

export class CreateReservationDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumberString()
  quantity!: string;

  @IsString()
  @MaxLength(255)
  source!: string;

  @IsOptional()
  @IsIn(['sales_order', 'production', 'subcontract', 'production_plan', 'purchase_order', 'material_request', 'work_order'])
  reservationType?: 'sales_order' | 'production' | 'subcontract' | 'production_plan' | 'purchase_order' | 'material_request' | 'work_order';
}

export class QueryLedgerDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class CreateBatchDto {
  @IsString()
  @MaxLength(64)
  batchNumber!: string;

  @IsUUID()
  itemId!: string;

  @IsUUID()
  orgNodeId!: string;

  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBatchStatusDto {
  @IsIn(BATCH_STATUSES)
  status!: (typeof BATCH_STATUSES)[number];
}

export class CreateSerialDto {
  @IsString()
  @MaxLength(64)
  serialNo!: string;

  @IsUUID()
  itemId!: string;

  @IsUUID()
  orgNodeId!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsUUID()
  purchaseReceiptId?: string;

  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBulkSerialsDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  orgNodeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serialNumbers!: string[];

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;
}

export class UpdateSerialStatusDto {
  @IsIn(SERIAL_STATUSES)
  status!: (typeof SERIAL_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  deliveryOrderId?: string;
}

export class ReconcileStockDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumberString()
  physicalQty!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

// --- Landed Cost Voucher DTOs ---
export class CreateLandedCostItemDto {
  @IsUUID()
  receiptMovementId!: string;

  @IsUUID()
  itemId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  originalRate!: string;
}

export class CreateLandedCostVoucherDto {
  @IsUUID()
  orgNodeId!: string;

  @IsOptional()
  @IsDateString()
  postingDate?: string;

  @IsNumberString()
  totalExpenseAmount!: string;

  @IsOptional()
  @IsIn(DISTRIBUTE_METHODS)
  distributeMethod?: (typeof DISTRIBUTE_METHODS)[number];

  @IsUUID()
  expenseAccountId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateLandedCostItemDto)
  items!: CreateLandedCostItemDto[];
}