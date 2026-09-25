import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseFilters } from '@nestjs/common';
import { IsString, ValidateIf } from 'class-validator';
import { AccountingNotFoundError, AccountingValidationError } from './accounting.errors';
import { AccountingExceptionFilter } from './accounting.exception-filter';
import { AccountingRepository } from './accounting.repository';
import { VOUCHER_TYPES, type VoucherType } from './voucher-types';
import {
  ACCOUNT_ROLES,
  isAccountRole,
  type AccountRole,
  type AccountRoleSpec,
} from './account-roles';

export class SetAccountRoleDto {
  @ValidateIf((_, v) => v !== null) @IsString() role!: string | null;
}

/** Standard account roles (plan item 32): the list, and assigning one to an account. */
@Controller({ path: 'accounting', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class AccountRolesController {
  constructor(private readonly repository: AccountingRepository) {}

  @Get('account-roles')
  roles(): { roles: Array<{ role: AccountRole } & AccountRoleSpec> } {
    return {
      roles: (Object.keys(ACCOUNT_ROLES) as AccountRole[]).map((role) => ({
        role,
        ...ACCOUNT_ROLES[role],
      })),
    };
  }

  /** Plan item 34: the 17 journal entry types and the rule each enforces. */
  @Get('voucher-types')
  voucherTypes(): {
    voucherTypes: Array<{ voucherType: VoucherType; label: string; rule: string }>;
  } {
    return {
      voucherTypes: (Object.keys(VOUCHER_TYPES) as VoucherType[]).map((voucherType) => ({
        voucherType,
        ...VOUCHER_TYPES[voucherType],
      })),
    };
  }

  @Patch('accounts/:id/role')
  async setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAccountRoleDto,
  ): Promise<{ accountId: string; role: AccountRole | null }> {
    const account = await this.repository.findAccountById(id);
    if (!account) throw new AccountingNotFoundError(`account ${id} does not exist`);
    if (dto.role === null) {
      await this.repository.setAccountRole(id, null);
      return { accountId: id, role: null };
    }
    if (!isAccountRole(dto.role))
      throw new AccountingValidationError(
        `unknown account role "${dto.role}" — see GET accounting/account-roles`,
      );
    const spec = ACCOUNT_ROLES[dto.role];
    const type = await this.repository.findAccountTypeById(account.accountTypeId);
    if (spec.normalBalance && type && type.normalBalance !== spec.normalBalance) {
      throw new AccountingValidationError(
        `نوع "${spec.label}" طبيعته ${spec.normalBalance === 'debit' ? 'مدين' : 'دائن'}، والحساب ${account.code} من نوع ${type.code} طبيعته ${type.normalBalance === 'debit' ? 'مدين' : 'دائن'}`,
      );
    }
    await this.repository.setAccountRole(id, dto.role);
    return { accountId: id, role: dto.role };
  }
}
