import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { ApproveDeviationDto, CloseRequestDto, CreateMaterialRequestDto, RejectRequestDto } from './production.dto';
import { ProductionExceptionFilter } from './production.exception-filter';
import { ProductionService } from './production.service';
import type { MaterialRequestRecord } from './production.types';

@Controller({ path: 'production', version: '1' })
@UseFilters(ProductionExceptionFilter)
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  @Get('material-requests')
  async requests(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ requests: MaterialRequestRecord[] }> {
    return { requests: await this.service.getRequests(jobOrderReference) };
  }

  @Get('material-requests/:id')
  async requestById(@Param('id', ParseUUIDPipe) id: string): Promise<{ request: MaterialRequestRecord }> {
    return { request: await this.service.getRequest(id) };
  }

  @Post('material-requests') @HttpCode(201)
  async createRequest(@Body() dto: CreateMaterialRequestDto): Promise<{ request: MaterialRequestRecord }> {
    const created = await this.service.createRequest({
      jobOrderReference: dto.jobOrderReference, itemId: dto.itemId, warehouseId: dto.warehouseId,
      plannedQuantity: dto.plannedQuantity, requestedQuantity: dto.requestedQuantity,
    });
    return { request: created };
  }

  @Post('material-requests/:id/approve-deviation') @HttpCode(200)
  async approveDeviation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveDeviationDto): Promise<{ request: MaterialRequestRecord }> {
    return { request: await this.service.approveDeviation(id, dto.deviationReason) };
  }

  @Post('material-requests/:id/reject') @HttpCode(200)
  async rejectRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectRequestDto): Promise<{ request: MaterialRequestRecord }> {
    return { request: await this.service.rejectRequest(id, dto.reason ?? '') };
  }

  @Post('material-requests/:id/issue') @HttpCode(200)
  async issueRequest(@Param('id', ParseUUIDPipe) id: string): Promise<{ request: MaterialRequestRecord }> {
    return { request: await this.service.issueRequest(id) };
  }

  @Post('material-requests/:id/close') @HttpCode(200)
  async closeRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseRequestDto): Promise<{ request: MaterialRequestRecord }> {
    return { request: await this.service.closeRequest(id, dto.actualUsedQuantity) };
  }
}
