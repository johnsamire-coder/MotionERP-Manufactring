import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

const DOC_TYPES = ['shop_drawing', 'cutting_list', 'other'] as const;

export class CreateTechnicalDocumentDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsIn(DOC_TYPES) documentType!: (typeof DOC_TYPES)[number];
  @IsString() @MaxLength(500) fileReference!: string;
  @IsOptional() @IsString() note?: string;
}

export class BomLineDto {
  @IsUUID() componentItemId!: string;
  @IsNumberString() quantity!: string;
}

export class CreateBomDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsUUID() productItemId!: string;
  @IsOptional() @IsNumberString() outputQuantity?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  lines!: BomLineDto[];
}
