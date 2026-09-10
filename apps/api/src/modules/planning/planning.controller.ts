import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseFilters } from '@nestjs/common';
import { CreatePlanDto, UpdatePlanDto } from './planning.dto';
import { PlanningExceptionFilter } from './planning.exception-filter';
import { PlanningService } from './planning.service';
import type { ProductionPlanRecord } from './planning.types';

@Controller({ path: 'planning', version: '1' })
@UseFilters(PlanningExceptionFilter)
export class PlanningController {
  constructor(private readonly service: PlanningService) {}

  @Get('plans')
  async plans(): Promise<{ plans: ProductionPlanRecord[] }> { return { plans: await this.service.getPlans() }; }

  @Get('plans/:id')
  async planById(@Param('id', ParseUUIDPipe) id: string): Promise<{ plan: ProductionPlanRecord }> {
    return { plan: await this.service.getPlan(id) };
  }

  @Post('plans') @HttpCode(201)
  async createPlan(@Body() dto: CreatePlanDto): Promise<{ plan: ProductionPlanRecord }> {
    const created = await this.service.createPlan({
      jobOrderReference: dto.jobOrderReference, priority: dto.priority, executionMode: dto.executionMode,
      internalQuantity: dto.internalQuantity, externalQuantity: dto.externalQuantity,
      plannedStartDate: dto.plannedStartDate, plannedEndDate: dto.plannedEndDate, note: dto.note,
    });
    return { plan: created };
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto): Promise<{ plan: ProductionPlanRecord }> {
    return { plan: await this.service.updatePlan(id, dto) };
  }

  @Post('plans/:id/lock') @HttpCode(200)
  async lockPlan(@Param('id', ParseUUIDPipe) id: string): Promise<{ plan: ProductionPlanRecord }> {
    return { plan: await this.service.lockPlan(id) };
  }
}
