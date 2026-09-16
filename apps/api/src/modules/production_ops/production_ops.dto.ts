import { IsBoolean, IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateWorkCenterDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsNumberString() ratePerMinute?: string;
}

export class CreateProductionStepDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsOptional() @IsUUID() workOrderId?: string;
  @IsUUID() workCenterId!: string;
  @IsString() @MaxLength(255) operationName!: string;
  @IsNumberString() standardTimeMinutes!: string;
  @IsOptional() @IsNumberString() forQuantity?: string;
  @IsOptional() @IsBoolean() allowOverproduction?: boolean;
  @IsOptional() @IsNumberString() overproductionPercentage?: string;
  @IsOptional() @IsUUID() operatorEmployeeId?: string;
}

export class CloseStepDto {
  @IsNumberString() actualTimeMinutes!: string;
}

export class AddTimeLogDto {
  @IsUUID() productionStepId!: string;
  @IsDateString() fromTime!: string;
  @IsOptional() @IsDateString() toTime?: string;
  @IsOptional() @IsNumberString() timeInMinutes?: string;
  @IsOptional() @IsNumberString() completedQuantity?: string;
  @IsOptional() @IsNumberString() processLossQuantity?: string;
}

export class CreateWorkOrderDto {
  @IsUUID() productItemId!: string;
  @IsUUID() bomId!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsString() @MaxLength(64) jobOrderReference?: string;
  @IsNumberString() qtyToManufacture!: string;
  @IsOptional() @IsUUID() sourceWarehouseId?: string;
  @IsOptional() @IsUUID() wipWarehouseId?: string;
  @IsUUID() finishedGoodsWarehouseId!: string;
  @IsOptional() @IsDateString() plannedStartDate?: string;
  @IsOptional() @IsBoolean() useMultiLevelBom?: boolean;
  @IsOptional() @IsBoolean() considerScrapItems?: boolean;
  @IsOptional() @IsNumberString() materialConsumptionPercentage?: string;
  @IsOptional() @IsIn(['transfer', 'move']) materialTransferMode?: 'transfer' | 'move';
}

export class CreateWorkstationTypeDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
}

export class CreateOperationDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsUUID() defaultWorkCenterId?: string;
  @IsOptional() @IsNumberString() standardTimeMinutes?: string;
}

export class CreateDowntimeEntryDto {
  @IsUUID() workCenterId!: string;
  @IsOptional() @IsUUID() operatorEmployeeId?: string;
  @IsString() stopReason!: string;
  @IsDateString() startTime!: string;
  @IsOptional() @IsString() remarks?: string;
}
