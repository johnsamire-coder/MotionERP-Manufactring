import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const ITEM_TYPES = ['raw_material', 'finished_product', 'semi_finished_product', 'consumable', 'spare_part', 'service'] as const;

export class CreateUomDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(255) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(20) symbol?: string;
  @IsString() classCode!: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) decimalPrecision?: number;
}

export class CreateItemCategoryDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(255) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
}

export class UpdateItemCategoryDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsUUID() parentId?: string | null;
}

export class CreateItemDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(255) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(ITEM_TYPES) itemType!: (typeof ITEM_TYPES)[number];
  @IsUUID() categoryId!: string;
  @IsUUID() baseUnitId!: string;
}

export class UpdateItemDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(ITEM_TYPES) itemType?: (typeof ITEM_TYPES)[number];
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() baseUnitId?: string;
}
