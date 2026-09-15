import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UseFilters } from '@nestjs/common';
import { CreateItemLeadTimeDto, CreateMaterialRequestDto, CreateMpsDto, CreateProductionPlanDto, CreateSalesForecastDto } from './planning.dto';
import { PlanningExceptionFilter } from './planning.exception-filter';
import { PlanningService } from './planning.service';
import type { ItemLeadTimeRecord, MasterProductionScheduleRecord, MaterialRequestRecord, ProductionPlanRecord, SalesForecastRecord } from './planning.types';

@Controller({ path: 'planning', version: '1' })
@UseFilters(PlanningExceptionFilter)
export class PlanningController {
  constructor(private readonly service: PlanningService) {}

  @Get('sales-forecasts')
  async salesForecasts(): Promise<{ salesForecasts: SalesForecastRecord[] }> {
    return { salesForecasts: await this.service.getSalesForecasts() };
  }

  @Get('sales-forecasts/:id')
  async salesForecastById(@Param('id', ParseUUIDPipe) id: string): Promise<{ salesForecast: SalesForecastRecord }> {
    return { salesForecast: await this.service.getSalesForecast(id) };
  }

  @Post('sales-forecasts') @HttpCode(201)
  async createSalesForecast(@Body() dto: CreateSalesForecastDto): Promise<{ salesForecast: SalesForecastRecord }> {
    const created = await this.service.createSalesForecast({
      orgNodeId: dto.orgNodeId, itemCategoryId: dto.itemCategoryId, warehouseId: dto.warehouseId,
      fromDate: dto.fromDate, toDate: dto.toDate, forecastPeriodicity: dto.forecastPeriodicity,
      lines: dto.lines.map((l) => ({ itemId: l.itemId, warehouseId: l.warehouseId, forecastQuantity: l.forecastQuantity, plannedQuantity: l.plannedQuantity })),
    });
    return { salesForecast: created };
  }

  @Post('sales-forecasts/:id/submit') @HttpCode(200)
  async submitSalesForecast(@Param('id', ParseUUIDPipe) id: string): Promise<{ salesForecast: SalesForecastRecord }> {
    return { salesForecast: await this.service.submitSalesForecast(id) };
  }

  @Get('material-requests')
  async materialRequests(): Promise<{ materialRequests: MaterialRequestRecord[] }> {
    return { materialRequests: await this.service.getMaterialRequests() };
  }

  @Get('material-requests/:id')
  async materialRequestById(@Param('id', ParseUUIDPipe) id: string): Promise<{ materialRequest: MaterialRequestRecord }> {
    return { materialRequest: await this.service.getMaterialRequest(id) };
  }

  @Post('material-requests') @HttpCode(201)
  async createMaterialRequest(@Body() dto: CreateMaterialRequestDto): Promise<{ materialRequest: MaterialRequestRecord }> {
    const created = await this.service.createMaterialRequest({
      orgNodeId: dto.orgNodeId, purpose: dto.purpose, requiredByDate: dto.requiredByDate, jobOrderReference: dto.jobOrderReference,
      lines: dto.lines.map((l) => ({ itemId: l.itemId, warehouseId: l.warehouseId, quantity: l.quantity, scheduleDate: l.scheduleDate })),
    });
    return { materialRequest: created };
  }

  @Post('material-requests/:id/submit') @HttpCode(200)
  async submitMaterialRequest(@Param('id', ParseUUIDPipe) id: string): Promise<{ materialRequest: MaterialRequestRecord }> {
    return { materialRequest: await this.service.submitMaterialRequest(id) };
  }

  @Get('production-plans')
  async productionPlans(): Promise<{ productionPlans: ProductionPlanRecord[] }> {
    return { productionPlans: await this.service.getProductionPlans() };
  }

  @Get('production-plans/:id')
  async productionPlanById(@Param('id', ParseUUIDPipe) id: string): Promise<{ productionPlan: ProductionPlanRecord }> {
    return { productionPlan: await this.service.getProductionPlan(id) };
  }

  @Post('production-plans') @HttpCode(201)
  async createProductionPlan(@Body() dto: CreateProductionPlanDto): Promise<{ productionPlan: ProductionPlanRecord }> {
    const created = await this.service.createProductionPlan({
      orgNodeId: dto.orgNodeId, planBy: dto.planBy, fromDate: dto.fromDate, toDate: dto.toDate,
      items: dto.items.map((it) => ({ productItemId: it.productItemId, bomId: it.bomId, qtyToPlan: it.qtyToPlan, warehouseId: it.warehouseId })),
    });
    return { productionPlan: created };
  }

  @Post('production-plans/:id/submit') @HttpCode(200)
  async submitProductionPlan(@Param('id', ParseUUIDPipe) id: string): Promise<{ productionPlan: ProductionPlanRecord }> {
    return { productionPlan: await this.service.submitProductionPlan(id) };
  }

  @Post('production-plans/:id/create-work-orders') @HttpCode(200)
  async createWorkOrdersFromPlan(@Param('id', ParseUUIDPipe) id: string): Promise<{ productionPlan: ProductionPlanRecord }> {
    return { productionPlan: await this.service.createWorkOrdersFromPlan(id) };
  }

  @Get('item-lead-times')
  async itemLeadTimes(): Promise<{ itemLeadTimes: ItemLeadTimeRecord[] }> {
    return { itemLeadTimes: await this.service.getItemLeadTimes() };
  }

  @Get('item-lead-times/:id')
  async itemLeadTimeById(@Param('id', ParseUUIDPipe) id: string): Promise<{ itemLeadTime: ItemLeadTimeRecord }> {
    return { itemLeadTime: await this.service.getItemLeadTime(id) };
  }

  @Post('item-lead-times') @HttpCode(201)
  async createItemLeadTime(@Body() dto: CreateItemLeadTimeDto): Promise<{ itemLeadTime: ItemLeadTimeRecord }> {
    const created = await this.service.createItemLeadTime({
      itemId: dto.itemId, orgNodeId: dto.orgNodeId,
      manufacturingTimeHours: dto.manufacturingTimeHours, isManufacturingLeadTime: dto.isManufacturingLeadTime, manufacturingBufferDays: dto.manufacturingBufferDays,
      purchaseTimeDays: dto.purchaseTimeDays, isPurchaseLeadTime: dto.isPurchaseLeadTime, purchaseBufferDays: dto.purchaseBufferDays,
      supplierLeadTimes: dto.supplierLeadTimes?.map((s) => ({ supplierName: s.supplierName, leadTimeDays: s.leadTimeDays })),
    });
    return { itemLeadTime: created };
  }

  @Get('master-production-schedules')
  async mpsList(): Promise<{ masterProductionSchedules: MasterProductionScheduleRecord[] }> {
    return { masterProductionSchedules: await this.service.getMpsList() };
  }

  @Get('master-production-schedules/:id')
  async mpsById(@Param('id', ParseUUIDPipe) id: string): Promise<{ masterProductionSchedule: MasterProductionScheduleRecord }> {
    return { masterProductionSchedule: await this.service.getMps(id) };
  }

  @Post('master-production-schedules') @HttpCode(201)
  async createMps(@Body() dto: CreateMpsDto): Promise<{ masterProductionSchedule: MasterProductionScheduleRecord }> {
    const created = await this.service.createMps({
      itemId: dto.itemId, orgNodeId: dto.orgNodeId, warehouseId: dto.warehouseId, fromDate: dto.fromDate, toDate: dto.toDate,
      totalForecastQuantity: dto.totalForecastQuantity, plannedQuantity: dto.plannedQuantity,
      scheduleLines: dto.scheduleLines.map((l) => ({ period: l.period, startDate: l.startDate, endDate: l.endDate, forecastQuantity: l.forecastQuantity, plannedQuantity: l.plannedQuantity })),
    });
    return { masterProductionSchedule: created };
  }

  @Post('master-production-schedules/:id/submit') @HttpCode(200)
  async submitMps(@Param('id', ParseUUIDPipe) id: string): Promise<{ masterProductionSchedule: MasterProductionScheduleRecord }> {
    return { masterProductionSchedule: await this.service.submitMps(id) };
  }

  @Post('master-production-schedules/:id/get-projected-quantity') @HttpCode(200)
  async mpsProjectedQuantity(@Param('id', ParseUUIDPipe) id: string): Promise<{ masterProductionSchedule: MasterProductionScheduleRecord }> {
    return { masterProductionSchedule: await this.service.getProjectedQuantity(id) };
  }
}
