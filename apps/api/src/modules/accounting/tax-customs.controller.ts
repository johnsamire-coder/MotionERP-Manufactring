// ============================================================
// Motion ERP — Egyptian Tax Authority & Customs Controller
// Step 79 | REST APIs
// ============================================================
import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { TaxAndCustomsService } from './tax-customs.service';
import {
  CapitalizeCustomsCostDto,
  CreateTaxSettlementDto,
  SettleAndPayVatDto,
  CreateWhtEntryDto,
  CreateCustomsDeclarationDto,
  QueryTaxSettlementsDto,
  QueryWhtEntriesDto,
  QueryCustomsDto,
} from './tax-customs.dto';
import type { RequestWithUser } from '../auth/request-with-user';

@Controller({ path: 'accounting/tax-customs', version: '1' })
export class TaxAndCustomsController {
  constructor(private readonly taxService: TaxAndCustomsService) {}

  @Post('vat/settle')
  async settleVat(@Body() dto: CreateTaxSettlementDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.taxService.createTaxSettlement(dto, userId);
  }

  @Post('vat/pay')
  async payVat(@Body() dto: SettleAndPayVatDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.taxService.payTaxSettlement(dto, userId);
  }

  @Get('vat/settlements')
  async listSettlements(@Query() query: QueryTaxSettlementsDto) {
    return this.taxService.listTaxSettlements(query);
  }

  @Post('wht')
  async createWht(@Body() dto: CreateWhtEntryDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.taxService.createWhtEntry(dto, userId);
  }

  @Get('wht/form41-summary')
  async getForm41Summary(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
  ) {
    return this.taxService.getForm41QuarterSummary(companyId, year, parseInt(quarter, 10));
  }

  @Get('wht')
  async listWht(@Query() query: QueryWhtEntriesDto) {
    return this.taxService.listWhtEntries(query);
  }

  @Post('customs')
  async createCustoms(@Body() dto: CreateCustomsDeclarationDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.taxService.createCustomsDeclaration(dto, userId);
  }

  @Post('customs/capitalize')
  async capitalizeCustoms(@Body() dto: CapitalizeCustomsCostDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.taxService.capitalizeCustomsToInventory(dto, userId);
  }

  @Get('customs')
  async listCustoms(@Query() query: QueryCustomsDto) {
    return this.taxService.listCustomsDeclarations(query);
  }
}
