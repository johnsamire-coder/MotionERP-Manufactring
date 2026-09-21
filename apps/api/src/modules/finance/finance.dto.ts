import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card'] as const;

export class CreateCollectionDto {
  @IsString()
  @MaxLength(64)
  jobOrderReference!: string;

  @IsOptional()
  @IsString()
  collectionDate?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsUUID()
  receivedInAccountId?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRetentionDto {
  @IsString()
  @MaxLength(64)
  jobOrderReference!: string;

  @IsNumberString()
  originalAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReleaseRetentionDto {
  @IsNumberString()
  amount!: string;
}

export class CreatePurchaseInvoiceLineDto {
  @IsUUID()
  itemId!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitCost!: string;

  @IsOptional()
  @IsNumberString()
  taxRate?: string;

  @IsOptional()
  @IsUUID()
  purchaseReceiptId?: string;
}

export class CreatePurchaseInvoiceDto {
  @IsUUID()
  orgNodeId!: string;

  @IsUUID()
  supplierId!: string;

  @IsString()
  @MaxLength(64)
  invoiceNumber!: string;

  @IsString()
  invoiceDate!: string;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsNumberString()
  exchangeRate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseInvoiceLineDto)
  lines!: CreatePurchaseInvoiceLineDto[];
}

export class CreateSalesInvoiceLineDto {
  @IsUUID()
  itemId!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitPrice!: string;

  @IsOptional()
  @IsNumberString()
  taxRate?: string;

  @IsOptional()
  @IsUUID()
  deliveryOrderId?: string;
}

export class CreateSalesInvoiceDto {
  @IsUUID()
  orgNodeId!: string;

  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  jobOrderReference?: string;

  @IsString()
  invoiceDate!: string;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsNumberString()
  exchangeRate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesInvoiceLineDto)
  lines!: CreateSalesInvoiceLineDto[];
}

export class CreatePaymentDto {
  @IsUUID()
  orgNodeId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  purchaseInvoiceId?: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @IsUUID()
  paidFromAccountId!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}