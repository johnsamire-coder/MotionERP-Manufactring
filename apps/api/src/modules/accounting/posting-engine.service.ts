import { Injectable, Logger } from '@nestjs/common';
import { AccountingValidationError } from './accounting.errors';
import { AccountingRepository } from './accounting.repository';
import { AccountingService } from './accounting.service';
import type { JournalEntryRecord } from './accounting.types';
import type { PostingMovementType, ResolvedAccounts, StockMovementPostingPayload } from './posting-engine.types';

@Injectable()
export class PostingEngineService {
  private readonly logger = new Logger(PostingEngineService.name);

  constructor(
    private readonly repository: AccountingRepository,
    private readonly accountingService: AccountingService,
  ) {}

  /**
   * Resolves the debit and credit accounts based on company configuration
   * and specific account determinations (warehouse / category / default).
   */
  async resolveStockMovementAccounts(
    orgNodeId: string,
    warehouseId: string,
    movementType: PostingMovementType,
    sourceModule?: string | null,
  ): Promise<ResolvedAccounts | null> {
    const config = await this.repository.findCompanyConfig(orgNodeId);
    const determinations = await this.repository.listAccountDeterminations(orgNodeId);

    // 1. Resolve Inventory Asset Account
    const whDet = determinations.find(
      (d) => d.determinationType === 'warehouse' && d.referenceId === warehouseId && d.accountPurpose === 'inventory',
    );
    const defaultInvDet = determinations.find(
      (d) => d.determinationType === 'default' && d.accountPurpose === 'inventory',
    );
    // Plan item 33: the company's default inventory account is the last fallback.
    const inventoryAccountId = whDet?.accountId ?? defaultInvDet?.accountId ?? config?.defaultInventoryAccountId ?? null;

    if (!inventoryAccountId) {
      this.logger.warn(`No inventory asset account mapped for orgNodeId=${orgNodeId}, warehouseId=${warehouseId}`);
      return null;
    }

    // 2. Resolve Contra Account
    let contraAccountId: string | null = null;

    if (movementType === 'receipt' || movementType === 'transfer_in') {
      if (sourceModule === 'production' || sourceModule === 'manufacturing') {
        // Finished Goods Receipt from manufacturing -> Credit WIP Account
        const wipDet = determinations.find((d) => d.accountPurpose === 'wip');
        contraAccountId = wipDet?.accountId ?? config?.defaultWipAccountId ?? null;
      } else {
        // Purchase receipt -> GRNI account
        const grniDet = determinations.find((d) => d.accountPurpose === 'purchase' || d.accountPurpose === 'grni');
        contraAccountId = grniDet?.accountId ?? config?.defaultGrniAccountId ?? null;
      }
    } else if (movementType === 'issue' || movementType === 'transfer_out') {
      if (sourceModule === 'production' || sourceModule === 'manufacturing') {
        // Manufacturing issue -> WIP account
        const wipDet = determinations.find((d) => d.accountPurpose === 'wip');
        contraAccountId = wipDet?.accountId ?? config?.defaultWipAccountId ?? null;
      } else if (sourceModule === 'delivery' || sourceModule === 'sales') {
        // Sales delivery -> COGS account
        const cogsDet = determinations.find((d) => d.accountPurpose === 'cogs');
        contraAccountId = cogsDet?.accountId ?? config?.defaultCogsAccountId ?? null;
      } else {
        // General consumption / adjustment
        const adjDet = determinations.find((d) => d.accountPurpose === 'stock_adjustment');
        contraAccountId = adjDet?.accountId ?? config?.defaultStockAdjustmentAccountId ?? null;
      }
    } else if (movementType === 'adjustment') {
      const adjDet = determinations.find((d) => d.accountPurpose === 'stock_adjustment');
      contraAccountId = adjDet?.accountId ?? config?.defaultStockAdjustmentAccountId ?? null;
    }

    if (!contraAccountId) {
      this.logger.warn(`No contra account mapped for movementType=${movementType}, sourceModule=${sourceModule}, orgNodeId=${orgNodeId}`);
      return null;
    }

    return { inventoryAccountId, contraAccountId };
  }

  /**
   * Plan item 33: when the company enforces its default accounts, a movement whose accounts
   * cannot be resolved is refused BEFORE anything is saved (otherwise it would post nothing).
   */
  async assertCanPost(orgNodeId: string, warehouseId: string, movementType: PostingMovementType, sourceModule?: string | null): Promise<void> {
    const config = await this.repository.findCompanyConfig(orgNodeId);
    if (!config?.enforceDefaultAccounts) return;
    const accounts = await this.resolveStockMovementAccounts(orgNodeId, warehouseId, movementType, sourceModule);
    if (!accounts) {
      throw new AccountingValidationError(
        `الشركة مفعّلة "الحسابات الافتراضية الإجبارية" والحركة دي (${movementType}${sourceModule ? ` / ${sourceModule}` : ''}) ملهاش حسابات — كمّل الحسابات من شاشة إعدادات الشركة (GET accounting/company-config/${orgNodeId}/readiness)`,
      );
    }
  }

  /**
   * Automatically generates and posts a balanced journal entry for a stock movement.
   * Guaranteed to be idempotent via unique idempotencyKey.
   */
  async postStockMovement(payload: StockMovementPostingPayload): Promise<JournalEntryRecord | null> {
    const valueNum = Number(payload.totalValue);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      return null; // Zero-value movements do not generate financial postings
    }

    const idempotencyKey = `stock-movement-${payload.movementId}`;

    // 1. Idempotency Check
    const existing = await this.repository.findEntryByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    // 2. Resolve Accounts
    const accounts = await this.resolveStockMovementAccounts(
      payload.orgNodeId,
      payload.warehouseId,
      payload.movementType,
      payload.sourceModule,
    );

    if (!accounts) {
      this.logger.log(`Skipping auto-posting for movement ${payload.movementId}: Accounts not mapped.`);
      return null;
    }

    const isReceipt = payload.movementType === 'receipt' || payload.movementType === 'transfer_in';
    const isIssue = payload.movementType === 'issue' || payload.movementType === 'transfer_out';
    const isAdjustment = payload.movementType === 'adjustment';

    let debitAccountId: string;
    let creditAccountId: string;
    let desc = payload.note?.trim() || `Stock ${payload.movementType} for item ${payload.itemId}`;

    if (isReceipt) {
      debitAccountId = accounts.inventoryAccountId;
      creditAccountId = accounts.contraAccountId;
      desc = `[Auto] Receipt: ${desc}`;
    } else if (isIssue) {
      debitAccountId = accounts.contraAccountId;
      creditAccountId = accounts.inventoryAccountId;
      desc = `[Auto] Issue: ${desc}`;
    } else if (isAdjustment) {
      const qtyNum = Number(payload.quantity);
      if (qtyNum > 0) {
        debitAccountId = accounts.inventoryAccountId;
        creditAccountId = accounts.contraAccountId;
        desc = `[Auto] Inventory Adjustment (+): ${desc}`;
      } else {
        debitAccountId = accounts.contraAccountId;
        creditAccountId = accounts.inventoryAccountId;
        desc = `[Auto] Inventory Adjustment (-): ${desc}`;
      }
    } else {
      return null;
    }

    const formattedAmount = valueNum.toFixed(4);

    // 3. Create Balanced Double-Entry Journal Entry
    const draftEntry = await this.accountingService.createEntry({
      orgNodeId: payload.orgNodeId,
      description: desc,
      reference: payload.movementId,
      entryDate: payload.movementDate,
      isAutoGenerated: true,
      idempotencyKey,
      sourceEventType: 'stock_movement',
      lines: [
        {
          accountId: debitAccountId,
          debitAmount: formattedAmount,
          creditAmount: '0',
          description: desc,
          costCenterId: payload.costCenterId,
          jobOrderId: payload.jobOrderId,
        },
        {
          accountId: creditAccountId,
          debitAmount: '0',
          creditAmount: formattedAmount,
          description: desc,
          costCenterId: payload.costCenterId,
          jobOrderId: payload.jobOrderId,
        },
      ],
    });

    // 4. Post immediately to General Ledger
    return this.accountingService.postEntry(draftEntry.id);
  }
}