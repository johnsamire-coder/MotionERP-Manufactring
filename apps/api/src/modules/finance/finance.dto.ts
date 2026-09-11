import { IsIn, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card'] as const;

export class CreateCollectionDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsOptional() @IsString() collectionDate?: string;
  @IsNumberString() amount!: string;
  @IsOptional() @IsString() @MaxLength(3) currencyCode?: string;
  @IsIn(PAYMENT_METHODS) paymentMethod!: (typeof PAYMENT_METHODS)[number];
  @IsOptional() @IsString() referenceNumber?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateRetentionDto {
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsNumberString() originalAmount!: string;
  @IsOptional() @IsString() @MaxLength(3) currencyCode?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsString() dueDate!: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReleaseRetentionDto {
  @IsNumberString() amount!: string;
}
