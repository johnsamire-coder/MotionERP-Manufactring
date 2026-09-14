import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
const DOC_TYPES = ['shop_drawing', 'cutting_list', 'other'] as const;
const CONSUME_BASED_ON = ['bom', 'material_transferred_for_manufacture'] as const;
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
  @IsUUID() productItemId!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsNumberString() outputQuantity?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isPhantomBom?: boolean;
  @IsOptional() @IsBoolean() allowAlternativeItem?: boolean;
  @IsOptional() @IsBoolean() qualityInspectionRequired?: boolean;
  @IsOptional() @IsIn(CONSUME_BASED_ON) consumeComponentsBasedOn?: (typeof CONSUME_BASED_ON)[number];
  @IsOptional() @IsUUID() defaultSourceWarehouseId?: string;
  @IsOptional() @IsUUID() defaultTargetWarehouseId?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  lines!: BomLineDto[];
}
