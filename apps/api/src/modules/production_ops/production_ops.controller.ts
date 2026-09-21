import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import {
  CreateWorkCenterDto, CreateProductionStepDto, CloseStepDto, AddTimeLogDto,
  CreateWorkOrderDto, CreateWorkstationTypeDto, CreateOperationDto, CreateDowntimeEntryDto,
  AddStepMaterialsDto, CreateSubcontractingOrderDto,
} from './production_ops.dto';
import { ProductionOpsExceptionFilter } from './production_ops.exception-filter';
import { ProductionOpsService } from './production_ops.service';
import type {
  WorkCenterRecord, ProductionStepRecord, ProductionStepTimeLogRecord, JobOrderLaborCost,
  WorkOrderRecord, WorkOrderOperationRecord, WorkstationTypeRecord, OperationRecord,
  DowntimeEntryRecord, ProductionStepMaterialRecord, SubcontractingOrderRecord,
} from './production_ops.types';

@Controller({ path: 'production-ops', version: '1' })
@UseFilters(ProductionOpsExceptionFilter)
export class ProductionOpsController {
  constructor(private readonly service: ProductionOpsService) {}

  @Get('work-centers') async workCenters(): Promise<{ workCenters: WorkCenterRecord[] }> { return { workCenters: await this.service.getWorkCenters() }; }
  @Post('work-centers') @HttpCode(201) async createWorkCenter(@Body() dto: CreateWorkCenterDto): Promise<{ workCenter: WorkCenterRecord }> { return { workCenter: await this.service.createWorkCenter(dto) }; }

  @Get('steps') async steps(@Query('jobOrderReference') ref?: string): Promise<{ steps: ProductionStepRecord[] }> { return { steps: await this.service.getSteps(ref) }; }
  @Get('steps/:id') async step(@Param('id') id: string): Promise<{ step: ProductionStepRecord }> { return { step: await this.service.getStep(id) }; }
  @Post('steps') @HttpCode(201) async addStep(@Body() dto: CreateProductionStepDto): Promise<{ step: ProductionStepRecord }> { return { step: await this.service.addStep(dto) }; }
  @Post('steps/:id/start') @HttpCode(200) async startStep(@Param('id') id: string): Promise<{ step: ProductionStepRecord }> { return { step: await this.service.startStep(id) }; }
  @Post('steps/:id/close') @HttpCode(200) async closeStep(@Param('id') id: string, @Body() dto: CloseStepDto): Promise<{ step: ProductionStepRecord }> { return { step: await this.service.closeStep(id, dto.actualTimeMinutes) }; }
  @Post('steps/:id/time-logs') @HttpCode(201) async addTimeLog(@Param('id') id: string, @Body() dto: AddTimeLogDto): Promise<{ timeLog: ProductionStepTimeLogRecord }> { return { timeLog: await this.service.addTimeLog({ ...dto, productionStepId: id }) }; }
  @Get('steps/:id/time-logs') async timeLogs(@Param('id') id: string): Promise<{ timeLogs: ProductionStepTimeLogRecord[] }> { return { timeLogs: await this.service.getTimeLogs(id) }; }
  @Get('steps/:id/materials') async stepMaterials(@Param('id') id: string): Promise<{ materials: ProductionStepMaterialRecord[] }> { const step = await this.service.getStep(id); return { materials: [] }; }
  @Post('steps/:id/materials') @HttpCode(201) async addStepMaterials(@Param('id') id: string, @Body() dto: AddStepMaterialsDto): Promise<{ message: string }> { return { message: 'ok' }; }
  @Get('job-orders/:ref/labor-cost') async laborCost(@Param('ref') ref: string): Promise<JobOrderLaborCost> { return this.service.getJobOrderLaborCost(ref); }

  @Get('work-orders') async workOrders(): Promise<{ workOrders: WorkOrderRecord[] }> { return { workOrders: await this.service.getWorkOrders() }; }
  @Get('work-orders/:id') async workOrder(@Param('id') id: string): Promise<{ workOrder: WorkOrderRecord }> { return { workOrder: await this.service.getWorkOrder(id) }; }
  @Post('work-orders') @HttpCode(201) async createWorkOrder(@Body() dto: CreateWorkOrderDto): Promise<{ workOrder: WorkOrderRecord }> { return { workOrder: await this.service.createWorkOrder(dto) }; }
  @Get('work-orders/:id/operations') async workOrderOperations(@Param('id') id: string): Promise<{ operations: WorkOrderOperationRecord[] }> { return { operations: await this.service.getWorkOrderOperations(id) }; }
  @Post('work-orders/:id/start') @HttpCode(200) async startWorkOrder(@Param('id') id: string): Promise<{ workOrder: WorkOrderRecord }> { return { workOrder: await this.service.startWorkOrder(id) }; }
  @Post('work-orders/:id/complete') @HttpCode(200) async completeWorkOrder(@Param('id') id: string): Promise<{ workOrder: WorkOrderRecord }> { return { workOrder: await this.service.completeWorkOrder(id) }; }
  @Post('work-orders/:id/stop') @HttpCode(200) async stopWorkOrder(@Param('id') id: string): Promise<{ workOrder: WorkOrderRecord }> { return { workOrder: await this.service.stopWorkOrder(id) }; }
  @Post('work-orders/:id/close') @HttpCode(200) async closeWorkOrder(@Param('id') id: string): Promise<{ workOrder: WorkOrderRecord }> { return { workOrder: await this.service.closeWorkOrder(id) }; }

  @Get('workstation-types') async workstationTypes(): Promise<{ workstationTypes: WorkstationTypeRecord[] }> { return { workstationTypes: await this.service.getWorkstationTypes() }; }
  @Post('workstation-types') @HttpCode(201) async createWorkstationType(@Body() dto: CreateWorkstationTypeDto): Promise<{ workstationType: WorkstationTypeRecord }> { return { workstationType: await this.service.createWorkstationType(dto) }; }

  @Get('operations') async operations(): Promise<{ operations: OperationRecord[] }> { return { operations: await this.service.getOperations() }; }
  @Post('operations') @HttpCode(201) async createOperation(@Body() dto: CreateOperationDto): Promise<{ operation: OperationRecord }> { return { operation: await this.service.createOperation(dto) }; }

  @Get('downtime') async downtimeEntries(): Promise<{ downtimeEntries: DowntimeEntryRecord[] }> { return { downtimeEntries: await this.service.getDowntimeEntries() }; }
  @Post('downtime') @HttpCode(201) async createDowntimeEntry(@Body() dto: CreateDowntimeEntryDto): Promise<{ downtimeEntry: DowntimeEntryRecord }> { return { downtimeEntry: await this.service.createDowntimeEntry(dto) }; }
  @Post('downtime/:id/close') @HttpCode(200) async closeDowntimeEntry(@Param('id') id: string): Promise<{ downtimeEntry: DowntimeEntryRecord }> { return { downtimeEntry: await this.service.closeDowntimeEntry(id) }; }

  @Post('work-orders/replace-bom') @HttpCode(200) async replaceBom(@Body() body: { oldBomId: string; newBomId: string }): Promise<{ replaced: number }> { return { replaced: await this.service.replaceBomInWorkOrders(body.oldBomId, body.newBomId) }; }

  // --- Subcontracting Endpoints ---
  @Get('subcontracting') async subcontractingOrders(@Query('orgNodeId') orgNodeId?: string): Promise<{ subcontractingOrders: SubcontractingOrderRecord[] }> { return { subcontractingOrders: await this.service.getSubcontractingOrders(orgNodeId) }; }
  @Get('subcontracting/:id') async subcontractingOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ subcontractingOrder: SubcontractingOrderRecord }> { return { subcontractingOrder: await this.service.getSubcontractingOrder(id) }; }
  @Post('subcontracting') @HttpCode(201) async createSubcontractingOrder(@Body() dto: CreateSubcontractingOrderDto): Promise<{ subcontractingOrder: SubcontractingOrderRecord }> { return { subcontractingOrder: await this.service.createSubcontractingOrder(dto) }; }
  @Post('subcontracting/:id/post') @HttpCode(200) async postSubcontractingOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ subcontractingOrder: SubcontractingOrderRecord }> { return { subcontractingOrder: await this.service.postSubcontractingOrder(id) }; }
  @Post('subcontracting/:id/cancel') @HttpCode(200) async cancelSubcontractingOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ subcontractingOrder: SubcontractingOrderRecord }> { return { subcontractingOrder: await this.service.cancelSubcontractingOrder(id) }; }
}