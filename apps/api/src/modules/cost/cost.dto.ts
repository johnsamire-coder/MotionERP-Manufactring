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
