import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import {
  AddTimeLogDto, CloseStepDto, CreateOperationDto, CreateProductionStepDto, CreateWorkCenterDto,
  CreateDowntimeEntryDto, CreateWorkOrderDto, CreateWorkstationTypeDto,
} from './production_ops.dto';
import { ProductionOpsExceptionFilter } from './production_ops.exception-filter';
import { ProductionOpsService } from './production_ops.service';
import type {
  JobOrderLaborCost, OperationRecord, ProductionStepRecord, ProductionStepTimeLogRecord, WorkCenterRecord,
  DowntimeEntryRecord, WorkOrderRecord, WorkstationTypeRecord,
} from './production_ops.types';

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
      jobOrderReference: dto.jobOrderReference, workOrderId: dto.workOrderId, workCenterId: dto.workCenterId,
      operationName: dto.operationName, standardTimeMinutes: dto.standardTimeMinutes, forQuantity: dto.forQuantity,
      allowOverproduction: dto.allowOverproduction, overproductionPercentage: dto.overproductionPercentage,
      operatorEmployeeId: dto.operatorEmployeeId,
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

  @Get('steps/:id/time-logs')
  async timeLogs(@Param('id', ParseUUIDPipe) id: string): Promise<{ timeLogs: ProductionStepTimeLogRecord[] }> {
    return { timeLogs: await this.service.getTimeLogs(id) };
  }

  @Post('time-logs') @HttpCode(201)
  async addTimeLog(@Body() dto: AddTimeLogDto): Promise<{ timeLog: ProductionStepTimeLogRecord }> {
    const created = await this.service.addTimeLog({
      productionStepId: dto.productionStepId, fromTime: dto.fromTime, toTime: dto.toTime,
      timeInMinutes: dto.timeInMinutes, completedQuantity: dto.completedQuantity, processLossQuantity: dto.processLossQuantity,
    });
    return { timeLog: created };
  }

  @Get('job-orders/:jobOrderReference/labor-cost')
  async laborCost(@Param('jobOrderReference') jobOrderReference: string): Promise<{ cost: JobOrderLaborCost }> {
    return { cost: await this.service.getJobOrderLaborCost(jobOrderReference) };
  }

  @Get('work-orders')
  async workOrders(): Promise<{ workOrders: WorkOrderRecord[] }> { return { workOrders: await this.service.getWorkOrders() }; }

  @Get('work-orders/:id')
  async workOrderById(@Param('id', ParseUUIDPipe) id: string): Promise<{ workOrder: WorkOrderRecord }> {
    return { workOrder: await this.service.getWorkOrder(id) };
  }

  @Post('work-orders') @HttpCode(201)
  async createWorkOrder(@Body() dto: CreateWorkOrderDto): Promise<{ workOrder: WorkOrderRecord }> {
    const created = await this.service.createWorkOrder({
      productItemId: dto.productItemId, bomId: dto.bomId, orgNodeId: dto.orgNodeId, jobOrderReference: dto.jobOrderReference,
      qtyToManufacture: dto.qtyToManufacture, sourceWarehouseId: dto.sourceWarehouseId, wipWarehouseId: dto.wipWarehouseId,
      finishedGoodsWarehouseId: dto.finishedGoodsWarehouseId, plannedStartDate: dto.plannedStartDate,
    });
    return { workOrder: created };
  }

  @Post('work-orders/:id/start') @HttpCode(200)
  async startWorkOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ workOrder: WorkOrderRecord }> {
    return { workOrder: await this.service.startWorkOrder(id) };
  }

  @Post('work-orders/:id/complete') @HttpCode(200)
  async completeWorkOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ workOrder: WorkOrderRecord }> {
    return { workOrder: await this.service.completeWorkOrder(id) };
  }

  @Post('work-orders/:id/stop') @HttpCode(200)
  async stopWorkOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ workOrder: WorkOrderRecord }> {
    return { workOrder: await this.service.stopWorkOrder(id) };
  }

  @Post('work-orders/:id/close') @HttpCode(200)
  async closeWorkOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ workOrder: WorkOrderRecord }> {
    return { workOrder: await this.service.closeWorkOrder(id) };
  }

  @Get('workstation-types')
  async workstationTypes(): Promise<{ workstationTypes: WorkstationTypeRecord[] }> { return { workstationTypes: await this.service.getWorkstationTypes() }; }

  @Post('workstation-types') @HttpCode(201)
  async createWorkstationType(@Body() dto: CreateWorkstationTypeDto): Promise<{ workstationType: WorkstationTypeRecord }> {
    const created = await this.service.createWorkstationType({ code: dto.code, name: dto.name });
    return { workstationType: created };
  }

  @Get('operations')
  async operations(): Promise<{ operations: OperationRecord[] }> { return { operations: await this.service.getOperations() }; }

  @Post('operations') @HttpCode(201)
  async createOperation(@Body() dto: CreateOperationDto): Promise<{ operation: OperationRecord }> {
    const created = await this.service.createOperation({
      code: dto.code, name: dto.name, defaultWorkCenterId: dto.defaultWorkCenterId, standardTimeMinutes: dto.standardTimeMinutes,
    });
    return { operation: created };
  }

  @Get('downtime-entries')
  async downtimeEntries(): Promise<{ downtimeEntries: DowntimeEntryRecord[] }> {
    return { downtimeEntries: await this.service.getDowntimeEntries() };
  }

  @Post('downtime-entries') @HttpCode(201)
  async createDowntimeEntry(@Body() dto: CreateDowntimeEntryDto): Promise<{ downtimeEntry: DowntimeEntryRecord }> {
    const created = await this.service.createDowntimeEntry({
      workCenterId: dto.workCenterId, operatorEmployeeId: dto.operatorEmployeeId,
      stopReason: dto.stopReason, startTime: dto.startTime, remarks: dto.remarks,
    });
    return { downtimeEntry: created };
  }

  @Post('downtime-entries/:id/close') @HttpCode(200)
  async closeDowntimeEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ downtimeEntry: DowntimeEntryRecord }> {
    return { downtimeEntry: await this.service.closeDowntimeEntry(id) };
  }
}
