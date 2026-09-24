import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RfqLineDto {
  @IsUUID() itemId!: string;
  @IsNumberString() quantity!: string;
}

export class CreateRfqDto {
  @IsOptional() @IsUUID() orgNodeId?: string;
  @IsOptional() @IsString() respondBy?: string;
  @IsOptional() @IsString() @MaxLength(128) materialRequestReference?: string;
  @IsOptional() @IsString() note?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RfqLineDto)
  lines!: RfqLineDto[];
  @IsArray() @ArrayMinSize(2) @IsUUID('all', { each: true }) supplierIds!: string[];
}

export class RfqResponseLineDto {
  @IsUUID() itemId!: string;
  @IsNumberString() unitPrice!: string;
  @IsOptional() @IsNumberString() quantity?: string;
}

export class RecordRfqResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RfqResponseLineDto)
  lines!: RfqResponseLineDto[];
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() note?: string;
}

export class AwardRfqDto {
  @IsUUID() supplierId!: string;
}
