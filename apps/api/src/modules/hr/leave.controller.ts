import { Body, Controller, Get, HttpCode, Post, Query, UseFilters } from '@nestjs/common';
import { IsArray, IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { HrExceptionFilter } from './hr.exception-filter';
import {
  LeaveService,
  type BulkAllocationResult,
  type LeaveAllocationRecord,
  type LeaveTypeRecord,
} from './leave.service';

export class CreateLeaveTypeDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsNumberString() maxDaysPerAllocation?: string;
}
export class BulkAllocateDto {
  @IsUUID() leaveTypeId!: string;
  @IsString() fromDate!: string;
  @IsString() toDate!: string;
  @IsNumberString() days!: string;
  @IsOptional() @IsUUID() orgNodeId?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) employeeIds?: string[];
}

@Controller({ path: 'hr', version: '1' })
@UseFilters(HrExceptionFilter)
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Get('leave-types')
  async types(): Promise<{ leaveTypes: LeaveTypeRecord[] }> {
    return { leaveTypes: await this.service.listTypes() };
  }

  @Post('leave-types')
  @HttpCode(201)
  async createType(@Body() dto: CreateLeaveTypeDto): Promise<{ leaveType: LeaveTypeRecord }> {
    return { leaveType: await this.service.createType(dto) };
  }

  @Get('leave-allocations')
  async allocations(
    @Query('employeeId') employeeId?: string,
  ): Promise<{ leaveAllocations: LeaveAllocationRecord[] }> {
    return { leaveAllocations: await this.service.listAllocations(employeeId) };
  }

  /** Plan item 20: allocate one leave to every active employee matching the filters. */
  @Post('leave-allocations/bulk')
  @HttpCode(201)
  async bulk(@Body() dto: BulkAllocateDto): Promise<{ result: BulkAllocationResult }> {
    return { result: await this.service.bulkAllocate(dto) };
  }
}
