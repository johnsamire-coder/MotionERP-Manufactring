import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UseFilters } from '@nestjs/common';
import { CreateSalesForecastDto } from './planning.dto';
import { PlanningExceptionFilter } from './planning.exception-filter';
import { PlanningService } from './planning.service';
import type { SalesForecastRecord } from './planning.types';

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
}
