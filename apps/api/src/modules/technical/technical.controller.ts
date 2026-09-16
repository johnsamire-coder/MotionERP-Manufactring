import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { CreateBomCreatorDto, CreateBomDto, CreateTechnicalDocumentDto } from './technical.dto';
import { TechnicalExceptionFilter } from './technical.exception-filter';
import { TechnicalService } from './technical.service';
import type { BomCreatorRecord, BomRecord, TechnicalDocumentRecord } from './technical.types';
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
  async boms(@Query('productItemId') productItemId?: string): Promise<{ boms: BomRecord[] }> {
    return { boms: await this.service.getBoms(productItemId) };
  }
  @Get('boms/:id')
  async bomById(@Param('id', ParseUUIDPipe) id: string): Promise<{ bom: BomRecord }> {
    return { bom: await this.service.getBom(id) };
  }
  @Post('boms') @HttpCode(201)
  async createBom(@Body() dto: CreateBomDto): Promise<{ bom: BomRecord }> {
    const created = await this.service.createBom({
      productItemId: dto.productItemId, orgNodeId: dto.orgNodeId, outputQuantity: dto.outputQuantity,
      isActive: dto.isActive, isDefault: dto.isDefault, isPhantomBom: dto.isPhantomBom,
      allowAlternativeItem: dto.allowAlternativeItem, qualityInspectionRequired: dto.qualityInspectionRequired,
      consumeComponentsBasedOn: dto.consumeComponentsBasedOn,
      defaultSourceWarehouseId: dto.defaultSourceWarehouseId, defaultTargetWarehouseId: dto.defaultTargetWarehouseId,
      lines: dto.lines.map((l) => ({ componentItemId: l.componentItemId, quantity: l.quantity, operationId: l.operationId, standardTimeMinutes: l.standardTimeMinutes })),
    });
    return { bom: created };
  }
  @Post('boms/:id/approve') @HttpCode(200)
  async approveBom(@Param('id', ParseUUIDPipe) id: string): Promise<{ bom: BomRecord }> {
    return { bom: await this.service.approveBom(id) };
  }
  @Get('bom-creators')
  async bomCreators(): Promise<{ bomCreators: BomCreatorRecord[] }> {
    return { bomCreators: await this.service.getBomCreators() };
  }
  @Get('bom-creators/:id')
  async bomCreatorById(@Param('id', ParseUUIDPipe) id: string): Promise<{ bomCreator: BomCreatorRecord }> {
    return { bomCreator: await this.service.getBomCreator(id) };
  }
  @Post('bom-creators') @HttpCode(201)
  async createBomCreator(@Body() dto: CreateBomCreatorDto): Promise<{ bomCreator: BomCreatorRecord }> {
    const created = await this.service.createBomCreator({
      productItemId: dto.productItemId, orgNodeId: dto.orgNodeId, quantityToProduce: dto.quantityToProduce,
      allowAlternativeItem: dto.allowAlternativeItem, remarks: dto.remarks,
      items: dto.items.map((it) => ({ tempId: it.tempId, parentTempId: it.parentTempId, componentItemId: it.componentItemId, quantity: it.quantity, isSubAssembly: it.isSubAssembly })),
    });
    return { bomCreator: created };
  }
  @Post('bom-creators/:id/create-boms') @HttpCode(200)
  async createBoms(@Param('id', ParseUUIDPipe) id: string): Promise<{ bomCreator: BomCreatorRecord }> {
    return { bomCreator: await this.service.createBoms(id) };
  }
}
