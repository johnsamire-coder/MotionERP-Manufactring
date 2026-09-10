import { IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMaterialRequestDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsNumberString() plannedQuantity!: string;
  @IsNumberString() requestedQuantity!: string;
}

export class ApproveDeviationDto {
  @IsString() deviationReason!: string;
}

export class RejectRequestDto {
  @IsOptional() @IsString() reason?: string;
}

export class CloseRequestDto {
  @IsNumberString() actualUsedQuantity!: string;
}
