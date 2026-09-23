import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { QualityExceptionFilter } from './quality.exception-filter';
import { CreateInspectionFromTemplateDto, CreateInspectionTemplateDto, RecordReadingsDto } from './quality-readings.dto';
import { QualityReadingsService } from './quality-readings.service';
import type { InspectionTemplateRecord, InspectionWithReadings } from './quality-readings.types';

@Controller({ path: 'quality', version: '1' })
@UseFilters(QualityExceptionFilter)
export class QualityReadingsController {
  constructor(private readonly service: QualityReadingsService) {}

  @Get('inspection-templates')
  async templates(): Promise<{ templates: InspectionTemplateRecord[] }> { return { templates: await this.service.listTemplates() }; }

  @Get('inspection-templates/:id')
  async template(@Param('id', ParseUUIDPipe) id: string): Promise<{ template: InspectionTemplateRecord }> {
    return { template: await this.service.getTemplate(id) };
  }

  @Post('inspection-templates') @HttpCode(201)
  async createTemplate(@Body() dto: CreateInspectionTemplateDto): Promise<{ template: InspectionTemplateRecord }> {
    return { template: await this.service.createTemplate(dto) };
  }

  @Post('inspections') @HttpCode(201)
  async createInspection(@Body() dto: CreateInspectionFromTemplateDto): Promise<{ inspection: InspectionWithReadings }> {
    return { inspection: await this.service.createInspectionFromTemplate(dto) };
  }

  @Get('inspections/:id')
  async inspection(@Param('id', ParseUUIDPipe) id: string): Promise<{ inspection: InspectionWithReadings }> {
    return { inspection: await this.service.getInspection(id) };
  }

  @Post('inspections/:id/readings') @HttpCode(200)
  async readings(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordReadingsDto): Promise<{ inspection: InspectionWithReadings }> {
    return { inspection: await this.service.recordReadings(id, dto) };
  }
}
