import { Body, Controller, Get, HttpCode, Post, Query, UseFilters } from '@nestjs/common';
import { CreateCommissionRuleDto, CreateEmployeeDto, CreateExternalCommissionDto, EarnCommissionDto, GeneratePayrollDto } from './hr.dto';
import { HrExceptionFilter } from './hr.exception-filter';
import { HrService } from './hr.service';
import type { CommissionEntryRecord, CommissionRuleRecord, EmployeeRecord, ExternalCommissionRecord, PayrollEntryRecord } from './hr.types';

@Controller({ path: 'hr', version: '1' })
@UseFilters(HrExceptionFilter)
export class HrController {
  constructor(private readonly service: HrService) {}

  @Get('employees')
  async employees(): Promise<{ employees: EmployeeRecord[] }> { return { employees: await this.service.getEmployees() }; }

  @Post('employees') @HttpCode(201)
  async createEmployee(@Body() dto: CreateEmployeeDto): Promise<{ employee: EmployeeRecord }> {
    return { employee: await this.service.createEmployee(dto) };
  }

  @Get('commission-rules')
  async commissionRules(@Query('employeeId') employeeId?: string): Promise<{ rules: CommissionRuleRecord[] }> {
    return { rules: await this.service.getCommissionRules(employeeId) };
  }

  @Post('commission-rules') @HttpCode(201)
  async createCommissionRule(@Body() dto: CreateCommissionRuleDto): Promise<{ rule: CommissionRuleRecord }> {
    return { rule: await this.service.createCommissionRule(dto) };
  }

  @Get('commission-entries')
  async commissionEntries(@Query('employeeId') employeeId?: string): Promise<{ entries: CommissionEntryRecord[] }> {
    return { entries: await this.service.getCommissionEntries(employeeId) };
  }

  @Post('commission-entries/earn') @HttpCode(201)
  async earnCommission(@Body() dto: EarnCommissionDto): Promise<{ entry: CommissionEntryRecord }> {
    const entry = await this.service.earnCommission(dto.employeeId, dto.jobOrderReference, dto.sourceReference, dto.basisAmount);
    return { entry };
  }

  @Get('external-commissions')
  async externalCommissions(): Promise<{ commissions: ExternalCommissionRecord[] }> { return { commissions: await this.service.getExternalCommissions() }; }

  @Post('external-commissions') @HttpCode(201)
  async createExternalCommission(@Body() dto: CreateExternalCommissionDto): Promise<{ commission: ExternalCommissionRecord }> {
    return { commission: await this.service.createExternalCommission(dto) };
  }

  @Get('payroll')
  async payroll(@Query('employeeId') employeeId?: string): Promise<{ entries: PayrollEntryRecord[] }> {
    return { entries: await this.service.getPayrollEntries(employeeId) };
  }

  @Post('payroll/generate') @HttpCode(201)
  async generatePayroll(@Body() dto: GeneratePayrollDto): Promise<{ entry: PayrollEntryRecord }> {
    const entry = await this.service.generatePayroll(dto.employeeId, dto.periodYear, dto.periodMonth);
    return { entry };
  }
}
