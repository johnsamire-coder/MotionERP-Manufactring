import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CrmExceptionFilter } from './crm.exception-filter';
import type { CustomerRecord, SupplierRecord } from './crm.types';
import {
  PartyGroupService,
  type PartyGroupNode,
  type PartyGroupRecord,
  type PartyGroupType,
} from './party-group.service';

export class CreatePartyGroupDto {
  @IsIn(['customer', 'supplier']) groupType!: PartyGroupType;
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsUUID() parentGroupId?: string;
  @IsOptional() @IsBoolean() isGroup?: boolean;
  @IsOptional() @IsNumberString() defaultCreditLimit?: string;
}
export class UpdatePartyGroupDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() parentGroupId?: string | null;
  @IsOptional() @IsBoolean() isGroup?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumberString() defaultCreditLimit?:
    string | null;
}
export class AssignGroupDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() groupId!: string | null;
}

@Controller({ path: 'crm', version: '1' })
@UseFilters(CrmExceptionFilter)
export class PartyGroupController {
  constructor(private readonly service: PartyGroupService) {}

  @Get('groups')
  async tree(@Query('type') type: string = 'customer'): Promise<{ tree: PartyGroupNode[] }> {
    return { tree: await this.service.tree(type === 'supplier' ? 'supplier' : 'customer') };
  }

  @Post('groups')
  @HttpCode(201)
  async create(@Body() dto: CreatePartyGroupDto): Promise<{ group: PartyGroupRecord }> {
    return { group: await this.service.create(dto) };
  }

  @Patch('groups/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartyGroupDto,
  ): Promise<{ group: PartyGroupRecord }> {
    return { group: await this.service.update(id, dto) };
  }

  @Get('groups/:id/members')
  async members(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('direct') direct?: string,
  ): Promise<{ members: Array<CustomerRecord | SupplierRecord> }> {
    return { members: await this.service.members(id, direct !== 'true') };
  }

  @Patch('customers/:id/group')
  async assignCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignGroupDto,
  ): Promise<{ customer: CustomerRecord }> {
    return { customer: await this.service.assignCustomer(id, dto.groupId ?? null) };
  }

  @Patch('suppliers/:id/group')
  async assignSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignGroupDto,
  ): Promise<{ supplier: SupplierRecord }> {
    return { supplier: await this.service.assignSupplier(id, dto.groupId ?? null) };
  }
}
