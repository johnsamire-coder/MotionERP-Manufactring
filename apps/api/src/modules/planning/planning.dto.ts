import { IsIn, IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const EXECUTION_MODES = ['internal', 'external', 'mixed'] as const;

export class CreatePlanDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsIn(EXECUTION_MODES) executionMode?: (typeof EXECUTION_MODES)[number];
  @IsOptional() @IsNumberString() internalQuantity?: string;
  @IsOptional() @IsNumberString() externalQuantity?: string;
  @IsOptional() @IsString() plannedStartDate?: string;
  @IsOptional() @IsString() plannedEndDate?: string;
  @IsOptional() @IsString() note?: string;
}

export class UpdatePlanDto {
  @IsOptional() @IsInt() @Min(0) priority?: number;
  @IsOptional() @IsIn(EXECUTION_MODES) executionMode?: (typeof EXECUTION_MODES)[number];
  @IsOptional() @IsNumberString() internalQuantity?: string;
  @IsOptional() @IsNumberString() externalQuantity?: string;
  @IsOptional() @IsString() plannedStartDate?: string;
  @IsOptional() @IsString() plannedEndDate?: string;
  @IsOptional() @IsString() note?: string;
}
