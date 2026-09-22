// ============================================================
// Motion ERP — Opening Entries Controller
// Step 92 | REST APIs
// ============================================================
import { Controller, Post, Body, Req } from '@nestjs/common';
import { OpeningEntriesService } from './opening-entries.service';
import { RollForwardOpeningEntryDto, ManualOpeningEntryDto } from './opening-entries.dto';

@Controller({ path: 'accounting/opening-entries', version: '1' })
export class OpeningEntriesController {
  constructor(private readonly openingEntriesService: OpeningEntriesService) {}

  @Post('roll-forward')
  async rollForwardBalances(@Body() dto: RollForwardOpeningEntryDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.openingEntriesService.rollForwardBalances(dto, userId);
  }

  @Post('manual')
  async createManualOpeningEntry(@Body() dto: ManualOpeningEntryDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.openingEntriesService.createManualOpeningEntry(dto, userId);
  }
}