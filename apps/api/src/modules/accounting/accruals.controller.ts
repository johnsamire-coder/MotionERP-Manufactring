// ============================================================
// Motion ERP — Accrual, Prepaid & Provision Controller (Fixed)
// Step 77 | Aligned with new DTOs & Service signatures
// ============================================================
import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { AccrualsService } from './accruals.service';
import {
  CreateAccrualDto,
  PostAccrualDto,
  ReverseAccrualDto,
  CreatePrepaidDto,
  AmortizePrepaidDto,
  CreateWarrantyProvisionDto,
  UtilizeProvisionDto,
} from './accruals.dto';

@Controller('v1/accounting/accruals')
export class AccrualsController {
  constructor(private readonly accrualsService: AccrualsService) {}

  // ── 1. Accrued Expenses ─────────────────────
  @Post()
  async createAccrual(@Body() dto: CreateAccrualDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.accrualsService.createAccrual(dto, userId);
  }

  @Post('post')
  async postAccrual(@Body() dto: PostAccrualDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.accrualsService.postAccrual(dto.id, userId);
  }

  @Post('reverse')
  async reverseAccrual(@Body() dto: ReverseAccrualDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.accrualsService.reverseAccrual(dto.id, dto.reversalDate, userId);
  }

  // ── 2. Prepaid Expenses ─────────────────────
  @Post('prepaids')
  async createPrepaid(@Body() dto: CreatePrepaidDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.accrualsService.createPrepaid(dto, userId);
  }

  @Post('prepaids/amortize')
  async amortizePrepaid(@Body() dto: AmortizePrepaidDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.accrualsService.amortizeMonth(dto.id, dto.amount, userId);
  }

  // ── 3. Warranty Provisions ──────────────────
  @Post('provisions')
  async createProvision(@Body() dto: CreateWarrantyProvisionDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.accrualsService.createProvision(dto, userId);
  }

  @Post('provisions/utilize')
  async utilizeProvision(@Body() dto: UtilizeProvisionDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.accrualsService.utilizeProvision(dto.id, dto.amount, userId);
  }
}