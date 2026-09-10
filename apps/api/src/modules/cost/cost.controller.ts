import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { AddCostDto, CreateComponentTypeDto, CreateCostEntryDto, CreateCostSheetDto } from './cost.dto';
import { CostExceptionFilter } from './cost.exception-filter';
import { CostService } from './cost.service';
import type { CostComponentTypeRecord, CostEntryRecord, CostSummary, JobCostSheetRecord } from './cost.types';

@Controller({ path: 'cost', version: '1' })
@UseFilters(CostExceptionFilter)
export class CostController {
  constructor(private readonly service: CostService) {}

  @Post('component-types') @HttpCode(201)
  async createComponentType(@Body() dto: CreateComponentTypeDto): Promise<{ componentType: CostComponentTypeRecord }> {
    const componentType = await this.service.createComponentType(dto);
    return { componentType };
  }

  @Post('sheets') @HttpCode(201)
  async createCostSheet(@Body() dto: CreateCostSheetDto): Promise<{ costSheet: JobCostSheetRecord }> {
    const sheet = await this.service.getOrCreateCostSheet(dto.jobOrderReference, dto.currencyCode);
    return { costSheet: sheet };
  }

  @Post('entries') @HttpCode(201)
  async addCostEntry(@Body() dto: CreateCostEntryDto): Promise<{ costEntry: CostEntryRecord }> {
    const entry = await this.service.addCostEntry({
      costSheetId: dto.costSheetId,
      componentTypeId: dto.componentTypeId,
      entryType: dto.entryType as any,
      amount: dto.amount,
      currencyCode: dto.currencyCode,
      description: dto.description,
      sourceReference: dto.sourceReference
    });
    return { costEntry: entry };
  }

  @Post('jobs/:jobOrderReference/material') @HttpCode(201)
  async addMaterialCost(
    @Param('jobOrderReference') jobOrderReference: string,
    @Body() dto: AddCostDto
  ): Promise<{ costEntry: CostEntryRecord }> {
    const entry = await this.service.addMaterialCost(jobOrderReference, dto.amount, dto.description, dto.sourceReference);
    return { costEntry: entry };
  }

  @Post('jobs/:jobOrderReference/labor') @HttpCode(201)
  async addLaborCost(
    @Param('jobOrderReference') jobOrderReference: string,
    @Body() dto: AddCostDto
  ): Promise<{ costEntry: CostEntryRecord }> {
    const entry = await this.service.addLaborCost(jobOrderReference, dto.amount, dto.description, dto.sourceReference);
    return { costEntry: entry };
  }

  @Get('jobs/:jobOrderReference/summary')
  async getCostSummary(@Param('jobOrderReference') jobOrderReference: string): Promise<{ summary: CostSummary }> {
    const summary = await this.service.getCostSummary(jobOrderReference);
    return { summary };
  }
}
