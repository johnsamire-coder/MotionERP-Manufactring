import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const CUSTOMER_STATUSES = ['lead', 'active', 'inactive', 'archived'] as const;
const INTERACTION_TYPES = ['visit', 'call', 'email', 'note'] as const;

export class CreateSupplierDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsUUID() orgNodeId!: string;
}

export class CreateCustomerDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsIn(CUSTOMER_STATUSES) status?: (typeof CUSTOMER_STATUSES)[number];
}

export class CreateInteractionDto {
  @IsUUID() customerId!: string;
  @IsIn(INTERACTION_TYPES) interactionType!: (typeof INTERACTION_TYPES)[number];
  @IsOptional() @IsString() interactionDate?: string;
  @IsOptional() @IsString() note?: string;
}
