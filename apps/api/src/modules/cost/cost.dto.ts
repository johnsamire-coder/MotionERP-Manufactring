import { IsEnum, IsNumberString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateComponentTypeDto {
  @Matches(/^[a-z_][a-z0-9_]*$/) @MaxLength(50) @IsString() code!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class CreateCostSheetDto {
  @IsString() @MaxLength(50) jobOrderReference!: string;
  @IsOptional() @IsString() @MaxLength(3) currencyCode?: string;
}

export class CreateCostEntryDto {
  @IsUUID() costSheetId!: string;
  @IsUUID() componentTypeId!: string;
  @IsEnum(['estimated', 'actual']) entryType!: string;
  @IsNumberString() amount!: string;
  @IsString() @MaxLength(3) currencyCode!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(100) sourceReference?: string;
}

export class AddCostDto {
  @IsNumberString() amount!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(100) sourceReference?: string;
}

/* ═══ OVERHEAD ALLOCATION DTOs ═══ */

export class CreateOverheadPoolDto {
  @Matches(/^[A-Z0-9_-]+$/) @MaxLength(50) @IsString() code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsEnum(['manufacturing_overhead', 'administrative', 'selling_marketing']) poolType!: string;
  @IsString() periodStart!: string;
  @IsString() periodEnd!: string;
  @IsOptional() @IsString() @MaxLength(3) currencyCode?: string;
  @IsUUID() orgNodeId!: string;
}

export class AddPoolEntryDto {
  @IsOptional() @IsUUID() accountId?: string;
  @IsString() @MaxLength(500) description!: string;
  @IsNumberString() amount!: string;
  @IsOptional() @IsString() @MaxLength(100) sourceReference?: string;
}

export class CreateAllocationPolicyDto {
  @Matches(/^[A-Z0-9_-]+$/) @MaxLength(50) @IsString() code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsUUID() poolId!: string;
  @IsEnum(['units_produced', 'direct_labor_hours', 'direct_labor_cost', 'machine_hours', 'direct_material_cost', 'sales_revenue'])
  allocationBase!: string;
  @IsOptional() @IsNumberString() percentage?: string;
  @IsUUID() orgNodeId!: string;
}

export class ExecuteAllocationDto {
  @IsUUID() policyId!: string;
}
