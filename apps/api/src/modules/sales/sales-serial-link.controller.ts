// ============================================================
// Motion ERP — Sales Serial Link Controller
// Step 69 | Medical Device Warranty & Tracking API
// ============================================================
import { Controller, Get, Post, Body, Query, Req, Param } from '@nestjs/common';
import { SalesSerialLinkService } from './sales-serial-link.service';
import {
  AllocateSalesSerialsDto,
  ActivateWarrantyInstallationDto,
  QuerySalesSerialsDto,
} from './sales-serial-link.dto';
import type { RequestWithUser } from '../auth/request-with-user';

@Controller({ path: 'sales/serials', version: '1' })
export class SalesSerialLinkController {
  constructor(private readonly serialService: SalesSerialLinkService) {}

  // ── تخصيص أرقام السيريال للفاتورة ───────────
  @Post('allocate')
  async allocateSerials(@Body() dto: AllocateSalesSerialsDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.serialService.allocateSerials(dto, userId);
  }

  // ── إثبات التركيب وتفعيل الضمان ─────────────
  @Post('activate-warranty')
  async activateWarranty(
    @Body() dto: ActivateWarrantyInstallationDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.serialService.activateWarranty(dto, userId);
  }

  // ── استعلام وبحث ────────────────────────────
  @Get()
  async querySerials(@Query() query: QuerySalesSerialsDto) {
    return this.serialService.querySerials(query);
  }

  // ── تتبع جهاز طبي محدد ──────────────────────
  @Get('trace/:serialNumber')
  async traceDevice(@Param('serialNumber') serialNumber: string) {
    return this.serialService.traceMedicalDevice(serialNumber);
  }
}
