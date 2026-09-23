import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { AwardRfqDto, CreateRfqDto, RecordRfqResponseDto } from './rfq.dto';
import { RfqService } from './rfq.service';
import type { RfqComparison, RfqRecord } from './rfq.types';
import { SalesExceptionFilter } from './sales.exception-filter';
import type { QuotationRecord } from './sales.types';

@Controller({ path: 'sales/rfqs', version: '1' })
@UseFilters(SalesExceptionFilter)
export class RfqController {
  constructor(private readonly service: RfqService) {}

  @Get()
  async list(): Promise<{ rfqs: RfqRecord[] }> { return { rfqs: await this.service.list() }; }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ rfq: RfqRecord }> { return { rfq: await this.service.get(id) }; }

  @Post() @HttpCode(201)
  async create(@Body() dto: CreateRfqDto): Promise<{ rfq: RfqRecord }> { return { rfq: await this.service.create(dto) }; }

  @Post(':id/send') @HttpCode(200)
  async send(@Param('id', ParseUUIDPipe) id: string): Promise<{ rfq: RfqRecord }> { return { rfq: await this.service.send(id) }; }

  @Post(':id/suppliers/:supplierId/response') @HttpCode(201)
  async respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: RecordRfqResponseDto,
  ): Promise<{ rfq: RfqRecord; quotation: QuotationRecord }> {
    return this.service.recordResponse(id, supplierId, dto);
  }

  @Post(':id/suppliers/:supplierId/decline') @HttpCode(200)
  async decline(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ): Promise<{ rfq: RfqRecord }> {
    return { rfq: await this.service.recordDecline(id, supplierId) };
  }

  @Get(':id/comparison')
  async compare(@Param('id', ParseUUIDPipe) id: string): Promise<{ comparison: RfqComparison }> {
    return { comparison: await this.service.compare(id) };
  }

  @Post(':id/award') @HttpCode(200)
  async award(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AwardRfqDto): Promise<{ rfq: RfqRecord }> {
    return { rfq: await this.service.award(id, dto.supplierId) };
  }

  @Post(':id/cancel') @HttpCode(200)
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<{ rfq: RfqRecord }> {
    return { rfq: await this.service.cancel(id) };
  }
}
