import { IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const CATEGORIES = ['manufacturing', 'administrative', 'selling', 'distribution'] as const;
const BASES = ['units_produced', 'direct_labor_hours', 'direct_labor_cost', 'machine_hours', 'direct_material_cost', 'sales_revenue'] as const;

export class CreateOverheadPoolDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(32) poolCode!: string;
  @IsString() @MaxLength(255) poolName!: string;
  @IsIn(CATEGORIES) category!: (typeof CATEGORIES)[number];
  @IsInt() @Min(2020) @Max(2100) periodYear!: number;
  @IsInt() @Min(1) @Max(12) periodMonth!: number;
  @IsNumberString() totalAmount!: string;
  @IsOptional() @IsString() currencyCode?: string;
}

export class CreateAllocationPolicyDto {
  @IsUUID() orgNodeId!: string;
  @IsUUID() poolId!: string;
  @IsIn(BASES) allocationBase!: (typeof BASES)[number];
  @IsOptional() @IsString() description?: string;
}

export class RunAllocationDto {
  @IsUUID() poolId!: string;
  @IsInt() @Min(2020) @Max(2100) periodYear!: number;
  @IsInt() @Min(1) @Max(12) periodMonth!: number;
}
