import { IsDateString, IsIn, IsInt, IsNumberString, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAccountTypeDto {
  code!: string;
  name!: string;
  normalBalance!: 'debit' | 'credit';
}

export class CreateChartOfAccountsDto {
  code!: string;
  name!: string;
  orgNodeId!: string;
  accountTypeId!: string;
  parentId?: string;
}

export class CreateFiscalYearDto {
  orgNodeId!: string;
  name!: string;
  startDate!: string;
  endDate!: string;
}

export class CreateCostCenterDto {
  orgNodeId!: string;
  code!: string;
  name!: string;
  parentId?: string;
  isGroup?: boolean;
}

export class CreateAccountDeterminationDto {
  orgNodeId!: string;
  determinationType!: 'item_category' | 'warehouse' | 'default';
  referenceId?: string;
  accountPurpose!: string;
  accountId!: string;
}

export class CreateJournalLineDto {
  accountId!: string;
  debitAmount?: string;
  creditAmount?: string;
  description?: string;
  partyType?: 'customer' | 'supplier';
  partyId?: string;
  costCenterId?: string;
  jobOrderId?: string;
}

export class CreateJournalEntryDto {
  orgNodeId!: string;
  description!: string;
  reference?: string;
  entryDate?: string;
  lines!: CreateJournalLineDto[];
}

export class UpsertCompanyAccountingConfigDto {
  orgNodeId!: string;
  baseCurrency?: string;
  inventoryValuationMethod?: string;
  defaultGrniAccountId?: string;
  defaultWipAccountId?: string;
  defaultCogsAccountId?: string;
  defaultMfgVarianceAccountId?: string;
  defaultPayableAccountId?: string;
  defaultReceivableAccountId?: string;
  defaultInputTaxAccountId?: string;
  defaultOutputTaxAccountId?: string;
  defaultScrapAccountId?: string;
  defaultStockAdjustmentAccountId?: string;
  defaultOhAppliedAccountId?: string;
}

export class FinancialReportQueryDto {
  @IsUUID()
  orgNodeId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class PartnerLedgerQueryDto {
  @IsIn(['customer', 'supplier'])
  partyType!: 'customer' | 'supplier';

  @IsUUID()
  partyId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// --- Fixed Asset DTOs ---
export class CreateFixedAssetDto {
  @IsUUID()
  orgNodeId!: string;

  @IsString()
  @MaxLength(64)
  assetCode!: string;

  @IsString()
  @MaxLength(255)
  assetName!: string;

  @IsDateString()
  purchaseDate!: string;

  @IsNumberString()
  purchaseCost!: string;

  @IsInt()
  @IsPositive()
  usefulLifeMonths!: number;

  @IsOptional()
  @IsNumberString()
  salvageValue?: string;

  @IsUUID()
  assetAccountId!: string;

  @IsUUID()
  accumulatedDepreciationAccountId!: string;

  @IsUUID()
  depreciationExpenseAccountId!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}

export class PostDepreciationDto {
  @IsOptional()
  @IsDateString()
  periodDate?: string;
}