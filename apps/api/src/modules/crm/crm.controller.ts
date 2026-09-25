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
  CreateCustomerDto,
  CreateInteractionDto,
  CreateSupplierDto,
  SetCreditLimitDto,
  SetSupplierHoldDto,
} from './crm.dto';
import { CrmExceptionFilter } from './crm.exception-filter';
import { CrmService } from './crm.service';
import type { CustomerInteractionRecord, CustomerRecord, SupplierRecord } from './crm.types';

@Controller({ path: 'crm', version: '1' })
@UseFilters(CrmExceptionFilter)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get('suppliers')
  async suppliers(): Promise<{ suppliers: SupplierRecord[] }> {
    return { suppliers: await this.service.getSuppliers() };
  }

  @Post('suppliers')
  @HttpCode(201)
  async createSupplier(@Body() dto: CreateSupplierDto): Promise<{ supplier: SupplierRecord }> {
    const created = await this.service.createSupplier({
      code: dto.code,
      name: dto.name,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail,
      orgNodeId: dto.orgNodeId,
    });
    return { supplier: created };
  }

  @Patch('suppliers/:id/hold')
  async setSupplierHold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSupplierHoldDto,
  ): Promise<{ supplier: SupplierRecord; holdActive: boolean }> {
    const supplier = await this.service.setSupplierHold(id, {
      holdType: dto.holdType,
      reason: dto.reason,
      releaseDate: dto.releaseDate,
    });
    return { supplier, holdActive: this.service.effectiveHold(supplier) !== null };
  }

  @Get('customers')
  async customers(): Promise<{ customers: CustomerRecord[] }> {
    return { customers: await this.service.getCustomers() };
  }

  @Post('customers')
  @HttpCode(201)
  async createCustomer(@Body() dto: CreateCustomerDto): Promise<{ customer: CustomerRecord }> {
    const created = await this.service.createCustomer({
      code: dto.code,
      name: dto.name,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail,
      orgNodeId: dto.orgNodeId,
      status: dto.status,
      creditLimit: dto.creditLimit,
    });
    return { customer: created };
  }

  @Patch('customers/:id/credit-limit')
  async setCreditLimit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCreditLimitDto,
  ): Promise<{ customer: CustomerRecord }> {
    return { customer: await this.service.setCreditLimit(id, dto.creditLimit) };
  }

  @Post('customers/:id/promote')
  @HttpCode(200)
  async promoteCustomer(@Param('id') id: string): Promise<{ customer: CustomerRecord }> {
    return { customer: await this.service.promoteToActive(id) };
  }

  @Get('interactions')
  async interactions(
    @Query('customerId') customerId?: string,
  ): Promise<{ interactions: CustomerInteractionRecord[] }> {
    return { interactions: await this.service.getInteractions(customerId) };
  }

  @Post('interactions')
  @HttpCode(201)
  async createInteraction(
    @Body() dto: CreateInteractionDto,
  ): Promise<{ interaction: CustomerInteractionRecord }> {
    const created = await this.service.logInteraction({
      customerId: dto.customerId,
      interactionType: dto.interactionType,
      interactionDate: dto.interactionDate,
      note: dto.note,
    });
    return { interaction: created };
  }
}
