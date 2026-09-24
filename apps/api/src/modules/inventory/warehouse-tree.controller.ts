import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseFilters } from '@nestjs/common';
import { IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { InventoryExceptionFilter } from './inventory.exception-filter';
import type { WarehouseRecord } from './inventory.types';
import { WarehouseTreeService, type WarehouseTreeNode } from './warehouse-tree.service';

export class SetWarehouseParentDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() parentWarehouseId!: string | null;
}
export class SetWarehouseGroupDto {
  @IsBoolean() isGroup!: boolean;
}

@Controller({ path: 'inventory/warehouse-tree', version: '1' })
@UseFilters(InventoryExceptionFilter)
export class WarehouseTreeController {
  constructor(private readonly service: WarehouseTreeService) {}

  @Get()
  async tree(): Promise<{ tree: WarehouseTreeNode[] }> {
    return { tree: await this.service.tree() };
  }

  @Patch(':id/parent')
  async setParent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetWarehouseParentDto,
  ): Promise<{ warehouse: WarehouseRecord }> {
    return { warehouse: await this.service.setParent(id, dto.parentWarehouseId ?? null) };
  }

  @Patch(':id/group')
  async setGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetWarehouseGroupDto,
  ): Promise<{ warehouse: WarehouseRecord }> {
    return { warehouse: await this.service.setGroup(id, dto.isGroup) };
  }
}
