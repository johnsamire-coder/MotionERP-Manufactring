import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { CloseStepDto, CreateProductionStepDto, CreateWorkCenterDto } from './production_ops.dto';
import { ProductionOpsExceptionFilter } from './production_ops.exception-filter';
import { ProductionOpsService } from './production_ops.service';
import type { JobOrderLaborCost, ProductionStepRecord, WorkCenterRecord } from './production_ops.types';

@Controller({ path: 'production-ops', version: '1' })
@UseFilters(ProductionOpsExceptionFilter)
export class ProductionOpsController {
  constructor(private readonly service: ProductionOpsService) {}

  @Get('work-centers')
  async workCenters(): Promise<{ workCenters: WorkCenterRecord[] }> { return { workCenters: await this.service.getWorkCenters() }; }

  @Post('work-centers') @HttpCode(201)
  async createWorkCenter(@Body() dto: CreateWorkCenterDto): Promise<{ workCenter: WorkCenterRecord }> {
    const created = await this.service.createWorkCenter({ code: dto.code, name: dto.name, orgNodeId: dto.orgNodeId, ratePerMinute: dto.ratePerMinute });
    return { workCenter: created };
  }

  @Get('steps')
  async steps(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ steps: ProductionStepRecord[] }> {
    return { steps: await this.service.getSteps(jobOrderReference) };
  }

  @Post('steps') @HttpCode(201)
  async addStep(@Body() dto: CreateProductionStepDto): Promise<{ step: ProductionStepRecord }> {
    const created = await this.service.addStep({
      jobOrderReference: dto.jobOrderReference, workCenterId: dto.workCenterId,
      operationName: dto.operationName, standardTimeMinutes: dto.standardTimeMinutes,
    });
    return { step: created };
  }

  @Post('steps/:id/start') @HttpCode(200)
  async startStep(@Param('id', ParseUUIDPipe) id: string): Promise<{ step: ProductionStepRecord }> {
    return { step: await this.service.startStep(id) };
  }

  @Post('steps/:id/close') @HttpCode(200)
  async closeStep(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseStepDto): Promise<{ step: ProductionStepRecord }> {
    return { step: await this.service.closeStep(id, dto.actualTimeMinutes) };
  }

  @Get('job-orders/:jobOrderReference/labor-cost')
  async laborCost(@Param('jobOrderReference') jobOrderReference: string): Promise<{ cost: JobOrderLaborCost }> {
    return { cost: await this.service.getJobOrderLaborCost(jobOrderReference) };
  }
}
