import { IsIn, IsNumberString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsString() @MaxLength(255) role!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsNumberString() baseSalary?: string;
}

export class CreateCommissionRuleDto {
  @IsUUID() employeeId!: string;
  @IsIn(['sale_value', 'collected_amount']) basis!: 'sale_value' | 'collected_amount';
  @IsNumberString() ratePercentage!: string;
}

export class EarnCommissionDto {
  @IsUUID() employeeId!: string;
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsString() @MaxLength(64) sourceReference!: string;
  @IsNumberString() basisAmount!: string;
}

export class CreateExternalCommissionDto {
  @IsString() @MaxLength(255) beneficiaryName!: string;
  @IsString() @MaxLength(64) jobOrderReference!: string;
  @IsNumberString() amount!: string;
  @IsString() basisDescription!: string;
  @IsOptional() @IsString() dueDate?: string;
}

export class GeneratePayrollDto {
  @IsUUID() employeeId!: string;
  @IsString() periodYear!: string;
  @IsString() periodMonth!: string;
}
