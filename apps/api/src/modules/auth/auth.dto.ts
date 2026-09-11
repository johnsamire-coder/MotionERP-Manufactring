import { IsIn, IsNumberString, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const ACTIONS = ['create', 'read', 'update', 'delete', 'approve'] as const;

export class CreateRoleDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) @MaxLength(64) @IsString() code!: string;
  @IsString() @MaxLength(255) name!: string;
}

export class CreatePermissionDto {
  @IsUUID() roleId!: string;
  @IsIn(ACTIONS) action!: (typeof ACTIONS)[number];
  @IsString() @MaxLength(255) resource!: string;
  @IsOptional() @IsUUID() scopeOrgNodeId?: string;
  @IsOptional() @IsNumberString() valueLimit?: string;
}

export class CreateUserDto {
  @IsString() @MinLength(3) @MaxLength(64) username!: string;
  @IsString() @MinLength(6) password!: string;
  @IsUUID() roleId!: string;
  @IsOptional() @IsString() employeeReference?: string;
}

export class LoginDto {
  @IsString() username!: string;
  @IsString() password!: string;
}

export class CheckPermissionDto {
  @IsUUID() userId!: string;
  @IsIn(ACTIONS) action!: (typeof ACTIONS)[number];
  @IsString() resource!: string;
  @IsOptional() @IsUUID() scopeOrgNodeId?: string;
  @IsOptional() @IsNumberString() value?: string;
}
