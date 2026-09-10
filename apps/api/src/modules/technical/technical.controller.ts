import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { CreateBomDto, CreateTechnicalDocumentDto } from './technical.dto';
import { TechnicalExceptionFilter } from './technical.exception-filter';
import { TechnicalService } from './technical.service';
import type { BomRecord, TechnicalDocumentRecord } from './technical.types';

@Controller({ path: 'technical', version: '1' })
@UseFilters(TechnicalExceptionFilter)
export class TechnicalController {
  constructor(private readonly service: TechnicalService) {}

  @Get('documents')
  async documents(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ documents: TechnicalDocumentRecord[] }> {
    return { documents: await this.service.getDocuments(jobOrderReference) };
  }

  @Post('documents') @HttpCode(201)
  async addDocument(@Body() dto: CreateTechnicalDocumentDto): Promise<{ document: TechnicalDocumentRecord }> {
    const created = await this.service.addDocument({
      jobOrderReference: dto.jobOrderReference, documentType: dto.documentType, fileReference: dto.fileReference, note: dto.note,
    });
    return { document: created };
  }

  @Get('boms')
  async boms(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ boms: BomRecord[] }> {
    return { boms: await this.service.getBoms(jobOrderReference) };
  }

  @Get('boms/:id')
  async bomById(@Param('id', ParseUUIDPipe) id: string): Promise<{ bom: BomRecord }> {
    return { bom: await this.service.getBom(id) };
  }

  @Post('boms') @HttpCode(201)
  async createBom(@Body() dto: CreateBomDto): Promise<{ bom: BomRecord }> {
    const created = await this.service.createBom({
      jobOrderReference: dto.jobOrderReference, productItemId: dto.productItemId, outputQuantity: dto.outputQuantity,
      lines: dto.lines.map((l) => ({ componentItemId: l.componentItemId, quantity: l.quantity })),
    });
    return { bom: created };
  }

  @Post('boms/:id/approve') @HttpCode(200)
  async approveBom(@Param('id', ParseUUIDPipe) id: string): Promise<{ bom: BomRecord }> {
    return { bom: await this.service.approveBom(id) };
  }
}
