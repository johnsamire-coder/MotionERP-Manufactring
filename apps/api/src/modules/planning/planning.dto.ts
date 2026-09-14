import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

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
