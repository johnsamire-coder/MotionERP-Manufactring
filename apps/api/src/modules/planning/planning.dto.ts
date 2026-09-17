import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

const PERIODICITIES = ['monthly', 'quarterly', 'half_yearly', 'yearly'] as const;

export class SalesForecastLineDto {
  @IsUUID() itemId!: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsNumberString() forecastQuantity!: string;
  @IsOptional() @IsNumberString() plannedQuantity?: string;
}

export class CreateSalesForecastDto {
  @IsUUID() orgNodeId!: string;
  @IsUUID() itemCategoryId!: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsString() fromDate!: string;
  @IsString() toDate!: string;
  @IsOptional() @IsIn(PERIODICITIES) forecastPeriodicity?: (typeof PERIODICITIES)[number];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesForecastLineDto)
  lines!: SalesForecastLineDto[];
}

export class MaterialRequestLineDto {
  @IsUUID() itemId!: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsNumberString() quantity!: string;
  @IsOptional() @IsString() scheduleDate?: string;
}

const PURPOSES = ['purchase', 'material_transfer', 'material_issue', 'manufacture'] as const;

export class CreateMaterialRequestDto {
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsIn(PURPOSES) purpose?: (typeof PURPOSES)[number];
  @IsOptional() @IsString() requiredByDate?: string;
  @IsOptional() @IsString() jobOrderReference?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialRequestLineDto)
  lines!: MaterialRequestLineDto[];
}

export class ProductionPlanItemDto {
  @IsUUID() productItemId!: string;
  @IsUUID() bomId!: string;
  @IsNumberString() qtyToPlan!: string;
  @IsOptional() @IsUUID() warehouseId?: string;
}

const PLAN_BY = ['job_order', 'material_request', 'sales_forecast'] as const;

export class CreateProductionPlanDto {
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsIn(PLAN_BY) planBy?: (typeof PLAN_BY)[number];
  @IsString() fromDate!: string;
  @IsString() toDate!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionPlanItemDto)
  items!: ProductionPlanItemDto[];
}

export class SupplierLeadTimeDto {
  @IsString() supplierName!: string;
  @IsNumberString() leadTimeDays!: string;
}

export class CreateItemLeadTimeDto {
  @IsUUID() itemId!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsNumberString() manufacturingTimeHours?: string;
  @IsOptional() @IsBoolean() isManufacturingLeadTime?: boolean;
  @IsOptional() @IsNumberString() manufacturingBufferDays?: string;
  @IsOptional() @IsNumberString() purchaseTimeDays?: string;
  @IsOptional() @IsBoolean() isPurchaseLeadTime?: boolean;
  @IsOptional() @IsNumberString() purchaseBufferDays?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierLeadTimeDto)
  supplierLeadTimes?: SupplierLeadTimeDto[];
}

export class MpsScheduleLineDto {
  @IsIn(['week', 'month', 'quarter', 'year']) period!: 'week' | 'month' | 'quarter' | 'year';
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsNumberString() forecastQuantity!: string;
  @IsOptional() @IsNumberString() plannedQuantity?: string;
}

export class CreateMpsDto {
  @IsUUID() itemId!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsString() fromDate!: string;
  @IsString() toDate!: string;
  @IsOptional() @IsNumberString() totalForecastQuantity?: string;
  @IsOptional() @IsNumberString() plannedQuantity?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MpsScheduleLineDto)
  scheduleLines!: MpsScheduleLineDto[];
}

export class SalesForecastPeriodLineDto {
  @IsString() periodName!: string;
  @IsNumberString() forecastQuantity!: string;
  @IsOptional() @IsNumberString() plannedQuantity?: string;
}

export class SetPeriodLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesForecastPeriodLineDto)
  lines!: SalesForecastPeriodLineDto[];
}
