import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { IsIn, IsNumberString, IsString, MaxLength } from 'class-validator';
import { HrExceptionFilter } from './hr.exception-filter';
import { FinalSettlementService, type FinalSettlementRecord } from './final-settlement.service';

export class SettlementLineDto {
  @IsIn(['payable', 'receivable']) direction!: 'payable' | 'receivable';
  @IsString() @MaxLength(64) component!: string;
  @IsString() @MaxLength(300) description!: string;
  @IsNumberString() amount!: string;
}

@Controller({ path: 'hr', version: '1' })
@UseFilters(HrExceptionFilter)
export class FinalSettlementController {
  constructor(private readonly service: FinalSettlementService) {}

  /** Plan item 21: draft settlement with suggested lines for a terminated employee. */
  @Post('employees/:id/final-settlement') @HttpCode(201)
  async create(@Param('id', ParseUUIDPipe) id: string): Promise<{ finalSettlement: FinalSettlementRecord }> {
    return { finalSettlement: await this.service.create(id) };
  }

  @Get('final-settlements/:id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ finalSettlement: FinalSettlementRecord }> {
    return { finalSettlement: await this.service.get(id) };
  }

  @Post('final-settlements/:id/lines') @HttpCode(201)
  async addLine(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SettlementLineDto): Promise<{ finalSettlement: FinalSettlementRecord }> {
    return { finalSettlement: await this.service.addLine(id, dto) };
  }

  @Delete('final-settlements/:id/lines/:lineId')
  async removeLine(
    @Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string,
  ): Promise<{ finalSettlement: FinalSettlementRecord }> {
    return { finalSettlement: await this.service.removeLine(id, lineId) };
  }

  @Post('final-settlements/:id/submit') @HttpCode(200)
  async submit(@Param('id', ParseUUIDPipe) id: string): Promise<{ finalSettlement: FinalSettlementRecord }> {
    return { finalSettlement: await this.service.submit(id) };
  }

  @Post('final-settlements/:id/cancel') @HttpCode(200)
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<{ finalSettlement: FinalSettlementRecord }> {
    return { finalSettlement: await this.service.cancel(id) };
  }
}
