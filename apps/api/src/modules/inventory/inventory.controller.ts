import { Body, Controller, Get, HttpCode, Param, Post, UseFilters } from '@nestjs/common';
import { CreateMovementDto, CreateReservationDto, CreateWarehouseDto } from './inventory.dto';
import { InventoryExceptionFilter } from './inventory.exception-filter';
import { InventoryService } from './inventory.service';
import type { StockBalanceRecord, StockMovementRecord, StockReservationRecord, WarehouseRecord } from './inventory.types';

@Controller({ path: 'inventory', version: '1' })
@UseFilters(InventoryExceptionFilter)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('warehouses')
  async warehouses(): Promise<{ warehouses: WarehouseRecord[] }> { return { warehouses: await this.service.getWarehouses() }; }

  @Post('warehouses') @HttpCode(201)
  async createWarehouse(@Body() dto: CreateWarehouseDto): Promise<{ warehouse: WarehouseRecord }> {
    const created = await this.service.createWarehouse({ code: dto.code, name: dto.name, orgNodeId: dto.orgNodeId });
    return { warehouse: created };
  }

  @Get('balances')
  async balances(): Promise<{ balances: StockBalanceRecord[] }> { return { balances: await this.service.getBalances() }; }

  @Get('movements')
  async movements(): Promise<{ movements: StockMovementRecord[] }> { return { movements: await this.service.getMovements() }; }

  @Post('movements') @HttpCode(201)
  async createMovement(@Body() dto: CreateMovementDto): Promise<{ movement: StockMovementRecord }> {
    const created = await this.service.createMovement({
      itemId: dto.itemId, warehouseId: dto.warehouseId, movementType: dto.movementType,
      quantity: dto.quantity, movementDate: dto.movementDate, note: dto.note,
    });
    return { movement: created };
  }

  @Get('reservations')
  async reservations(): Promise<{ reservations: StockReservationRecord[] }> { return { reservations: await this.service.getReservations() }; }

  @Post('reservations') @HttpCode(201)
  async createReservation(@Body() dto: CreateReservationDto): Promise<{ reservation: StockReservationRecord }> {
    const created = await this.service.reserveStock({
      itemId: dto.itemId, warehouseId: dto.warehouseId, quantity: dto.quantity, source: dto.source,
    });
    return { reservation: created };
  }

  @Post('reservations/:id/release') @HttpCode(200)
  async releaseReservation(@Param('id') id: string): Promise<{ reservation: StockReservationRecord }> {
    return { reservation: await this.service.releaseReservation(id) };
  }
}
