import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { ReplaceBomDto } from './manufacturing_tools.dto';
import { ManufacturingToolsExceptionFilter } from './manufacturing_tools.exception-filter';
import { ManufacturingToolsService } from './manufacturing_tools.service';
import type { ReplaceBomResult } from './manufacturing_tools.service';

@Controller({ path: 'manufacturing-tools', version: '1' })
@UseFilters(ManufacturingToolsExceptionFilter)
export class ManufacturingToolsController {
  constructor(private readonly service: ManufacturingToolsService) {}

  @Post('bom-update-tool/replace')
  async replaceBom(@Body() dto: ReplaceBomDto): Promise<{ result: ReplaceBomResult }> {
    const result = await this.service.replaceBom(dto.currentBomId, dto.newBomId);
    return { result };
  }
}
