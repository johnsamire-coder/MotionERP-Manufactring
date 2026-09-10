import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

const DIRECTIONS = ['outgoing', 'incoming'] as const;

export class QuotationLineDto {
  @IsUUID() itemId!: string;
  @IsNumberString() quantity!: string;
  @IsNumberString() unitPrice!: string;
}

export class CreateQuotationDto {
  @IsIn(DIRECTIONS) direction!: (typeof DIRECTIONS)[number];
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsString() quotationDate?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() note?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationLineDto)
  lines!: QuotationLineDto[];
}

export class ApproveQuotationDto {
  @IsOptional() @IsString() @MaxLength(255) customerPoReference?: string;
}
