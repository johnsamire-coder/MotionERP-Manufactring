import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  CreateBatchDto,
  CreateBulkSerialsDto,
  CreateLandedCostVoucherDto,
  CreateMovementDto,
  CreateReservationDto,
  CreateSerialDto,
  CreateWarehouseDto,
  QueryLedgerDto,
  ReconcileStockDto,
  TransferStockDto,
  UpdateBatchStatusDto,
  UpdateSerialStatusDto,
} from './inventory.dto';
import { InventoryExceptionFilter } from './inventory.exception-filter';
import { InventoryService } from './inventory.service';
import { GrniReportService, type ReceivedNotBilledReport } from './grni-report.service';
import type {
  StockBalanceRecord,
  StockMovementRecord,
  StockReservationRecord,
  WarehouseRecord,
  StockLedgerEntryRecord,
  ItemBatchRecord,
  BatchBalanceRecord,
  SerialNumberRecord,
  ReconcileStockResult,
  LandedCostVoucherRecord,
  TransferStockResult,
  StockBinRecord,
} from './inventory.types';

@Controller({ path: 'inventory', version: '1' })
@UseFilters(InventoryExceptionFilter)
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly grni: GrniReportService,
  ) {}

  /** Purchase receipts not yet (fully) billed, reconciled with the GRNI ledger balance (plan item 14). */
  @Get('reports/received-not-billed')
  async receivedNotBilled(
    @Query('orgNodeId') orgNodeId?: string,
    @Query('includeFullyBilled') includeFullyBilled?: string,
  ): Promise<{ report: ReceivedNotBilledReport }> {
    return { report: await this.grni.receivedNotBilled(orgNodeId, includeFullyBilled === 'true') };
  }

  @Get('warehouses')
  async warehouses(): Promise<{ warehouses: WarehouseRecord[] }> {
    return { warehouses: await this.service.getWarehouses() };
  }

  @Post('warehouses')
  @HttpCode(201)
  async createWarehouse(@Body() dto: CreateWarehouseDto): Promise<{ warehouse: WarehouseRecord }> {
    const created = await this.service.createWarehouse({
      code: dto.code,
      name: dto.name,
      orgNodeId: dto.orgNodeId,
    });
    return { warehouse: created };
  }

  @Get('balances')
  async balances(): Promise<{ balances: StockBalanceRecord[] }> {
    return { balances: await this.service.getBalances() };
  }

  @Get('movements')
  async movements(): Promise<{ movements: StockMovementRecord[] }> {
    return { movements: await this.service.getMovements() };
  }

  @Post('movements')
  @HttpCode(201)
  async createMovement(@Body() dto: CreateMovementDto): Promise<{ movement: StockMovementRecord }> {
    const created = await this.service.createMovement({
      itemId: dto.itemId,
      warehouseId: dto.warehouseId,
      movementType: dto.movementType,
      quantity: dto.quantity,
      movementDate: dto.movementDate,
      note: dto.note,
      unitCost: dto.unitCost,
      sourceModule: dto.sourceModule,
      sourceId: dto.sourceId,
      allowBackdate: dto.allowBackdate,
      backdateReason: dto.backdateReason,
      batchId: dto.batchId,
      serialNos: dto.serialNos,
      purpose: dto.purpose,
      purchaseOrderId: dto.purchaseOrderId,
    });
    return { movement: created };
  }

  @Get('reservations')
  async reservations(): Promise<{ reservations: StockReservationRecord[] }> {
    return { reservations: await this.service.getReservations() };
  }

  @Post('reservations')
  @HttpCode(201)
  async createReservation(
    @Body() dto: CreateReservationDto,
  ): Promise<{ reservation: StockReservationRecord }> {
    const created = await this.service.reserveStock({
      itemId: dto.itemId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
      source: dto.source,
      reservationType: dto.reservationType,
    });
    return { reservation: created };
  }

  /** Per item/warehouse Bin: actual, the seven reservation / request types, available and projected (plan item 13). */
  @Get('bins')
  async bins(
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<{ bins: StockBinRecord[] }> {
    return { bins: await this.service.getBins(itemId, warehouseId) };
  }

  @Post('reservations/:id/release')
  @HttpCode(200)
  async releaseReservation(
    @Param('id') id: string,
  ): Promise<{ reservation: StockReservationRecord }> {
    return { reservation: await this.service.releaseReservation(id) };
  }

  @Get('ledger')
  async ledger(@Query() query: QueryLedgerDto): Promise<{ entries: StockLedgerEntryRecord[] }> {
    const entries = await this.service.getLedgerEntries(query.itemId, query.warehouseId);
    return { entries };
  }

  // --- Medical Batches Endpoints ---
  @Post('transfers')
  @HttpCode(201)
  async transfer(@Body() dto: TransferStockDto): Promise<TransferStockResult> {
    return this.service.transferStock({
      itemId: dto.itemId,
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      quantity: dto.quantity,
      purpose: dto.purpose,
      batchId: dto.batchId,
      serialNos: dto.serialNos,
      movementDate: dto.movementDate,
      note: dto.note,
      sourceModule: dto.sourceModule,
      sourceId: dto.sourceId,
    });
  }

  @Get('movements/:id/serials')
  async movementSerials(@Param('id', ParseUUIDPipe) id: string): Promise<{ serialNos: string[] }> {
    return { serialNos: await this.service.getMovementSerialNos(id) };
  }

  @Get('serials/:id/movements')
  async serialMovements(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ movements: StockMovementRecord[] }> {
    return { movements: await this.service.getSerialMovements(id) };
  }

  @Get('batch-balances')
  async batchBalances(
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('batchId') batchId?: string,
  ): Promise<{ batchBalances: BatchBalanceRecord[] }> {
    return { batchBalances: await this.service.getBatchBalances(itemId, warehouseId, batchId) };
  }

  @Get('batches')
  async batches(
    @Query('itemId') itemId?: string,
    @Query('orgNodeId') orgNodeId?: string,
  ): Promise<{ batches: ItemBatchRecord[] }> {
    return { batches: await this.service.getBatches(itemId, orgNodeId) };
  }

  @Get('batches/:id/trace')
  async traceBatch(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Awaited<ReturnType<InventoryService['traceBatch']>>> {
    return this.service.traceBatch(id);
  }

  @Get('batches/:id')
  async batch(@Param('id', ParseUUIDPipe) id: string): Promise<{ batch: ItemBatchRecord }> {
    return { batch: await this.service.getBatch(id) };
  }

  @Post('batches')
  @HttpCode(201)
  async createBatch(@Body() dto: CreateBatchDto): Promise<{ batch: ItemBatchRecord }> {
    return { batch: await this.service.createBatch(dto) };
  }

  @Patch('batches/:id/status')
  @HttpCode(200)
  async setBatchStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBatchStatusDto,
  ): Promise<{ batch: ItemBatchRecord }> {
    return { batch: await this.service.setBatchStatus(id, dto.status) };
  }

  // --- Serial Numbers Endpoints ---
  @Get('serials')
  async serials(
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('batchId') batchId?: string,
  ): Promise<{ serials: SerialNumberRecord[] }> {
    return { serials: await this.service.getSerials(itemId, warehouseId, batchId) };
  }

  @Get('serials/:id')
  async serial(@Param('id', ParseUUIDPipe) id: string): Promise<{ serial: SerialNumberRecord }> {
    return { serial: await this.service.getSerial(id) };
  }

  @Post('serials')
  @HttpCode(201)
  async createSerial(@Body() dto: CreateSerialDto): Promise<{ serial: SerialNumberRecord }> {
    return { serial: await this.service.createSerialNumber(dto) };
  }

  @Post('serials/bulk')
  @HttpCode(201)
  async createSerialsBulk(
    @Body() dto: CreateBulkSerialsDto,
  ): Promise<{ serials: SerialNumberRecord[] }> {
    return {
      serials: await this.service.createSerialNumbersBulk(
        dto.itemId,
        dto.orgNodeId,
        dto.serialNumbers,
        dto.warehouseId,
        dto.batchId,
      ),
    };
  }

  @Patch('serials/:id/status')
  @HttpCode(200)
  async setSerialStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSerialStatusDto,
  ): Promise<{ serial: SerialNumberRecord }> {
    return {
      serial: await this.service.setSerialStatus(
        id,
        dto.status,
        dto.warehouseId,
        dto.deliveryOrderId,
      ),
    };
  }

  // --- Stock Reconciliation Endpoint ---
  @Post('reconcile')
  @HttpCode(200)
  async reconcileStock(@Body() dto: ReconcileStockDto): Promise<ReconcileStockResult> {
    return this.service.reconcileStock(dto);
  }

  // --- Landed Cost Voucher Endpoints ---
  @Get('landed-cost-vouchers')
  async landedCostVouchers(
    @Query('orgNodeId') orgNodeId?: string,
  ): Promise<{ landedCostVouchers: LandedCostVoucherRecord[] }> {
    return { landedCostVouchers: await this.service.getLandedCostVouchers(orgNodeId) };
  }

  @Get('landed-cost-vouchers/:id')
  async landedCostVoucher(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ landedCostVoucher: LandedCostVoucherRecord }> {
    return { landedCostVoucher: await this.service.getLandedCostVoucher(id) };
  }

  @Post('landed-cost-vouchers')
  @HttpCode(201)
  async createLandedCostVoucher(
    @Body() dto: CreateLandedCostVoucherDto,
  ): Promise<{ landedCostVoucher: LandedCostVoucherRecord }> {
    const created = await this.service.createLandedCostVoucher(dto);
    return { landedCostVoucher: created };
  }

  @Post('landed-cost-vouchers/:id/post')
  @HttpCode(200)
  async postLandedCostVoucher(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ landedCostVoucher: LandedCostVoucherRecord }> {
    return { landedCostVoucher: await this.service.postLandedCostVoucher(id) };
  }

  @Post('landed-cost-vouchers/:id/cancel')
  @HttpCode(200)
  async cancelLandedCostVoucher(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ landedCostVoucher: LandedCostVoucherRecord }> {
    return { landedCostVoucher: await this.service.cancelLandedCostVoucher(id) };
  }
}
