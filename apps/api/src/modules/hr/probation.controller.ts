import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { HrExceptionFilter } from './hr.exception-filter';
import { ProbationService, type ProbationRecord } from './probation.service';

export class StartProbationDto {
  @IsString() dateOfJoining!: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) months?: number;
  @IsOptional() @IsString() probationEndDate?: string;
}
export class ExtendProbationDto {
  @IsString() probationEndDate!: string;
  @IsString() @MaxLength(500) reason!: string;
}
export class ConfirmEmployeeDto {
  @IsOptional() @IsString() confirmationDate?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@Controller({ path: 'hr', version: '1' })
@UseFilters(HrExceptionFilter)
export class ProbationController {
  constructor(private readonly service: ProbationService) {}

  @Get('probation/due')
  async due(@Query('withinDays') withinDays?: string): Promise<{ employees: ProbationRecord[] }> {
    const n = withinDays === undefined ? 14 : Number(withinDays);
    return { employees: await this.service.due(Number.isFinite(n) && n >= 0 ? n : 14) };
  }

  @Get('employees/:id/probation')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ probation: ProbationRecord }> {
    return { probation: await this.service.get(id) };
  }

  @Post('employees/:id/probation')
  @HttpCode(200)
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartProbationDto,
  ): Promise<{ probation: ProbationRecord }> {
    return { probation: await this.service.start(id, dto) };
  }

  @Post('employees/:id/probation/extend')
  @HttpCode(200)
  async extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendProbationDto,
  ): Promise<{ probation: ProbationRecord }> {
    return { probation: await this.service.extend(id, dto) };
  }

  @Post('employees/:id/confirm')
  @HttpCode(200)
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmEmployeeDto,
  ): Promise<{ probation: ProbationRecord }> {
    return { probation: await this.service.confirm(id, dto) };
  }
}
