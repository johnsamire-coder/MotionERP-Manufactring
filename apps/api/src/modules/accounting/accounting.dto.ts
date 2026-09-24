import { Type } from 'class-transformer';
import type { VoucherType } from './voucher-types';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumberString, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

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

export class CreateFiscalYearDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}

export class CreateCostCenterDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsBoolean() isGroup?: boolean;
}

export class CreateAccountDeterminationDto {
  @IsUUID() orgNodeId!: string;
  @IsIn(['item_category', 'warehouse', 'default']) determinationType!: 'item_category' | 'warehouse' | 'default';
  @IsOptional() @IsUUID() referenceId?: string;
  @IsString() accountPurpose!: string;
  @IsUUID() accountId!: string;
}

export class CreateJournalLineDto {
  @IsUUID() accountId!: string;
  @IsOptional() @IsNumberString() debitAmount?: string;
  @IsOptional() @IsNumberString() creditAmount?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsIn(['customer', 'supplier']) partyType?: 'customer' | 'supplier';
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsUUID() costCenterId?: string;
  @IsOptional() @IsUUID() jobOrderId?: string;
}

export class CreateJournalEntryDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @IsOptional() @IsDateString() entryDate?: string;
  @IsOptional() @IsIn(['journal_entry', 'inter_company_journal_entry', 'bank_entry', 'cash_entry', 'credit_card_entry', 'debit_note', 'credit_note', 'contra_entry', 'excise_entry', 'write_off_entry', 'opening_entry', 'depreciation_entry', 'exchange_rate_revaluation', 'exchange_gain_or_loss', 'deferred_revenue', 'deferred_expense', 'reversal_of_itc']) voucherType?: VoucherType;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => CreateJournalLineDto) lines!: CreateJournalLineDto[];
}

export class UpsertCompanyAccountingConfigDto {
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsString() @MaxLength(3) baseCurrency?: string;
  @IsOptional() @IsIn(['weighted_average', 'fifo', 'standard']) inventoryValuationMethod?: string;
  @IsOptional() @IsUUID() defaultGrniAccountId?: string;
  @IsOptional() @IsUUID() defaultWipAccountId?: string;
  @IsOptional() @IsUUID() defaultCogsAccountId?: string;
  @IsOptional() @IsUUID() defaultMfgVarianceAccountId?: string;
  @IsOptional() @IsUUID() defaultPayableAccountId?: string;
  @IsOptional() @IsUUID() defaultReceivableAccountId?: string;
  @IsOptional() @IsUUID() defaultInputTaxAccountId?: string;
  @IsOptional() @IsUUID() defaultOutputTaxAccountId?: string;
  @IsOptional() @IsUUID() defaultScrapAccountId?: string;
  @IsOptional() @IsUUID() defaultStockAdjustmentAccountId?: string;
  @IsOptional() @IsUUID() defaultOhAppliedAccountId?: string;
  @IsOptional() @IsUUID() defaultBankAccountId?: string;
  @IsOptional() @IsUUID() defaultCashAccountId?: string;
  @IsOptional() @IsUUID() defaultIncomeAccountId?: string;
  @IsOptional() @IsUUID() defaultInventoryAccountId?: string;
  @IsOptional() @IsUUID() defaultRoundOffAccountId?: string;
  @IsOptional() @IsUUID() defaultWriteOffAccountId?: string;
  @IsOptional() @IsUUID() defaultExchangeGainLossAccountId?: string;
  @IsOptional() @IsUUID() defaultDepreciationExpenseAccountId?: string;
  @IsOptional() @IsBoolean() enforceDefaultAccounts?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() accountsFrozenUntil?: string | null;
  @IsOptional() @IsBoolean() bookAdvancesSeparately?: boolean;
  @IsOptional() @IsUUID() defaultAdvanceReceivedAccountId?: string;
  @IsOptional() @IsUUID() defaultAdvancePaidAccountId?: string;
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

export class PostVatSettlementDto {
  @IsUUID()
  orgNodeId!: string;

  @IsDateString()
  settlementDate!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsUUID()
  taxAuthorityPayableAccountId!: string;
}