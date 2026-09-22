// ============================================================
// Motion ERP — Overhead Cost Pools & Allocation Controller
// Step 86 | REST APIs
// ============================================================
import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { OverheadService, RunAllocationDto } from './overhead.service';

@Controller({ path: 'overhead', version: '1' })
export class OverheadController {
  constructor(private readonly overheadService: OverheadService) {}

  @Get('pools/summary')
  async getPoolsSummary(@Query('periodMonth') periodMonth?: string) {
    return this.overheadService.getOverheadPoolsSummary(periodMonth);
  }

  @Post('allocate')
  async runAllocation(@Body() dto: RunAllocationDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.overheadService.runAllocationEngine(dto, userId);
  }

  @Post('integrate-depreciation')
  async integrateDepreciation(@Body() dto: {
    companyId: string;
    fiscalYearId: string;
    periodId: string;
    periodMonth: string;
    totalMachineryDepreciation: number;
    machinesBreakdown?: Array<{ machineName: string; depreciationAmount: number; operatingHours: number }>;
  }, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.overheadService.integrateMachineryDepreciation(dto, userId);
  }
}