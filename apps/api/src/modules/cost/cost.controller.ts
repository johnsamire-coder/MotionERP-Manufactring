import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import {
  AddCostDto, AddPoolEntryDto, CreateAllocationPolicyDto,
  CreateComponentTypeDto, CreateCostEntryDto, CreateCostSheetDto,
  CreateOverheadPoolDto, ExecuteAllocationDto,
} from './cost.dto';
import { CostExceptionFilter } from './cost.exception-filter';
import { CostService } from './cost.service';
import type {
  AllocationExecutionSummary, AllocationPolicyRecord, AllocationResultRecord,
  CostComponentTypeRecord, CostEntryRecord, CostSummary,
  JobCostSheetRecord, OverheadPoolEntryRecord, OverheadPoolRecord,
} from './cost.types';

@Controller({ path: 'cost', version: '1' })
@UseFilters(CostExceptionFilter)
export class CostController {
  constructor(private readonly svc: CostService) {}

  /* ── Existing ── */
  @Post('component-types') @HttpCode(201)
  async createComponentType(@Body() dto: CreateComponentTypeDto): Promise<{ componentType: CostComponentTypeRecord }> {
    return { componentType: await this.svc.createComponentType(dto) };
  }
  @Post('sheets') @HttpCode(201)
  async createCostSheet(@Body() dto: CreateCostSheetDto): Promise<{ costSheet: JobCostSheetRecord }> {
    return { costSheet: await this.svc.getOrCreateCostSheet(dto.jobOrderReference, dto.currencyCode) };
  }
  @Post('entries') @HttpCode(201)
  async addCostEntry(@Body() dto: CreateCostEntryDto): Promise<{ costEntry: CostEntryRecord }> {
    return { costEntry: await this.svc.addCostEntry({ costSheetId: dto.costSheetId, componentTypeId: dto.componentTypeId, entryType: dto.entryType as any, amount: dto.amount, currencyCode: dto.currencyCode, description: dto.description, sourceReference: dto.sourceReference }) };
  }
  @Post('jobs/:ref/material') @HttpCode(201)
  async addMaterialCost(@Param('ref') ref: string, @Body() dto: AddCostDto): Promise<{ costEntry: CostEntryRecord }> {
    return { costEntry: await this.svc.addMaterialCost(ref, dto.amount, dto.description, dto.sourceReference) };
  }
  @Post('jobs/:ref/labor') @HttpCode(201)
  async addLaborCost(@Param('ref') ref: string, @Body() dto: AddCostDto): Promise<{ costEntry: CostEntryRecord }> {
    return { costEntry: await this.svc.addLaborCost(ref, dto.amount, dto.description, dto.sourceReference) };
  }
  @Get('jobs/:ref/summary')
  async getCostSummary(@Param('ref') ref: string): Promise<{ summary: CostSummary }> {
    return { summary: await this.svc.getCostSummary(ref) };
  }

  /* ═══ OVERHEAD POOLS ═══ */
  @Get('pools')
  async getPools(): Promise<{ pools: OverheadPoolRecord[] }> {
    return { pools: await this.svc.getPools() };
  }
  @Post('pools') @HttpCode(201)
  async createPool(@Body() dto: CreateOverheadPoolDto): Promise<{ pool: OverheadPoolRecord }> {
    return { pool: await this.svc.createPool({ code: dto.code, name: dto.name, poolType: dto.poolType as any, periodStart: dto.periodStart, periodEnd: dto.periodEnd, currencyCode: dto.currencyCode, orgNodeId: dto.orgNodeId }) };
  }
  @Post('pools/:id/entries') @HttpCode(201)
  async addPoolEntry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddPoolEntryDto): Promise<{ entry: OverheadPoolEntryRecord }> {
    return { entry: await this.svc.addPoolEntry(id, { accountId: dto.accountId, description: dto.description, amount: dto.amount, sourceReference: dto.sourceReference }) };
  }
  @Post('pools/:id/activate') @HttpCode(200)
  async activatePool(@Param('id', ParseUUIDPipe) id: string): Promise<{ pool: OverheadPoolRecord }> {
    return { pool: await this.svc.activatePool(id) };
  }

  /* ═══ ALLOCATION POLICIES ═══ */
  @Get('policies')
  async getPolicies(): Promise<{ policies: AllocationPolicyRecord[] }> {
    return { policies: await this.svc.getPolicies() };
  }
  @Post('policies') @HttpCode(201)
  async createPolicy(@Body() dto: CreateAllocationPolicyDto): Promise<{ policy: AllocationPolicyRecord }> {
    return { policy: await this.svc.createPolicy({ code: dto.code, name: dto.name, poolId: dto.poolId, allocationBase: dto.allocationBase as any, percentage: dto.percentage, orgNodeId: dto.orgNodeId }) };
  }

  /* ═══ EXECUTE ALLOCATION ═══ */
  @Post('allocate') @HttpCode(200)
  async executeAllocation(@Body() dto: ExecuteAllocationDto): Promise<{ result: AllocationExecutionSummary }> {
    return { result: await this.svc.executeAllocation(dto.policyId) };
  }
  @Get('allocations/:policyId/results')
  async getResults(@Param('policyId', ParseUUIDPipe) policyId: string): Promise<{ results: AllocationResultRecord[] }> {
    return { results: await this.svc.getAllocationResults(policyId) };
  }

  @Get('job-cost-sheet/:workOrderId')
  async getJobCostSheet(@Param('workOrderId') workOrderId: string) {
    return this.svc.getJobCostSheetAnalytics(workOrderId);
  }

  @Get('standard-vs-actual/:workOrderId')
  async getStandardVsActual(@Param('workOrderId') workOrderId: string) {
    return this.svc.getStandardVsActualAnalytics(workOrderId);
  }

  @Get('material-variance/:workOrderId')
  async getMaterialVariance(@Param('workOrderId') workOrderId: string) {
    return this.svc.get4LevelMaterialVarianceAnalytics(workOrderId);
  }
}