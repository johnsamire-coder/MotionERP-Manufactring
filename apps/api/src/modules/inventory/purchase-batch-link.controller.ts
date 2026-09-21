// ============================================================
// Motion ERP — Purchase Batch Link Controller
// Step 68 | Medical Traceability API
// ============================================================
import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { PurchaseBatchLinkService } from './purchase-batch-link.service';
import {
  RegisterPurchaseBatchesDto,
  UpdateBatchStatusDto,
  QueryPurchaseBatchesDto,
  TraceabilitySearchDto,
} from './purchase-batch-link.dto';

@Controller('v1/inventory/purchase-batches')
export class PurchaseBatchLinkController {
  constructor(private readonly batchLinkService: PurchaseBatchLinkService) {}

  // ── تسجيل اللوطات عند الاستلام ──────────────
  @Post('register')
  async registerBatches(@Body() dto: RegisterPurchaseBatchesDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.batchLinkService.registerBatches(dto, userId);
  }

  // ── تحديث حالة الحجر الصحي ──────────────────
  @Post('status')
  async updateStatus(@Body() dto: UpdateBatchStatusDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.batchLinkService.updateBatchStatus(dto, userId);
  }

  // ── الاستعلام عن اللوطات ────────────────────
  @Get()
  async queryBatches(@Query() query: QueryPurchaseBatchesDto) {
    return this.batchLinkService.queryBatches(query);
  }

  // ── التتبع الطبي ────────────────────────────
  @Get('trace')
  async traceabilitySearch(@Query() query: TraceabilitySearchDto) {
    return this.batchLinkService.traceabilitySearch(query);
  }
}