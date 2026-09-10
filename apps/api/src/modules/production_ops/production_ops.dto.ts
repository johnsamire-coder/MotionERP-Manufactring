import { IsNumberString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateWorkCenterDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsNumberString() ratePerMinute?: string;
}

export class CreateProductionStepDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsUUID() workCenterId!: string;
  @IsString() @MaxLength(255) operationName!: string;
  @IsNumberString() standardTimeMinutes!: string;
}

export class CloseStepDto {
  @IsNumberString() actualTimeMinutes!: string;
}
