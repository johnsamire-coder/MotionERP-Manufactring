import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class CreateAccountTypeDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsIn(['debit', 'credit']) normalBalance!: 'debit' | 'credit';
}

export class CreateChartOfAccountsDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsUUID() orgNodeId!: string;
  @IsUUID() accountTypeId!: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class JournalLineDto {
  @IsUUID() accountId!: string;
  @IsOptional() @IsNumberString() debitAmount?: string;
  @IsOptional() @IsNumberString() creditAmount?: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateJournalEntryDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(500) description!: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() entryDate?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}
