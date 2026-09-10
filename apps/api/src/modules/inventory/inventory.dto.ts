import { IsIn, IsNumberString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const MOVEMENT_TYPES = ['receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment'] as const;

export class CreateWarehouseDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsUUID() orgNodeId!: string;
}

export class CreateMovementDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsIn(MOVEMENT_TYPES) movementType!: (typeof MOVEMENT_TYPES)[number];
  @IsNumberString() quantity!: string;
  @IsOptional() @IsString() movementDate?: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateReservationDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsNumberString() quantity!: string;
  @IsString() @MaxLength(255) source!: string;
}
