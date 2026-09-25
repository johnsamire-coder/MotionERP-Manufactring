import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { FinanceNotFoundError, FinanceValidationError } from './finance.errors';
import { FinanceRepository } from './finance.repository';
import { purchaseInvoiceHold } from './finance.schema';

export interface PurchaseInvoiceHoldRecord {
  purchaseInvoiceId: string;
  reason: string;
  releaseDate: string | null;
  createdAt: string;
  active: boolean;
}

/** Hold / release a single purchase invoice for payment (plan item 19). */
@Injectable()
export class PurchaseInvoiceHoldService {
  constructor(
    private readonly database: DatabaseService,
    private readonly finance: FinanceRepository,
  ) {}

  async get(purchaseInvoiceId: string): Promise<PurchaseInvoiceHoldRecord | null> {
    const rows = await this.database.db
      .select()
      .from(purchaseInvoiceHold)
      .where(eq(purchaseInvoiceHold.purchaseInvoiceId, purchaseInvoiceId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    const active = !r.releaseDate || r.releaseDate.getTime() > Date.now();
    return {
      purchaseInvoiceId: r.purchaseInvoiceId,
      reason: r.reason,
      releaseDate: r.releaseDate ? r.releaseDate.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      active,
    };
  }

  async hold(
    purchaseInvoiceId: string,
    reason: string,
    releaseDate?: string,
  ): Promise<PurchaseInvoiceHoldRecord> {
    const invoice = await this.finance.findPurchaseInvoiceById(purchaseInvoiceId);
    if (!invoice)
      throw new FinanceNotFoundError(`purchase invoice ${purchaseInvoiceId} does not exist`);
    if (invoice.status === 'cancelled')
      throw new FinanceValidationError(`purchase invoice ${invoice.systemNumber} is cancelled`);
    if (!reason?.trim()) throw new FinanceValidationError('a hold reason is required');
    let release: Date | null = null;
    if (releaseDate) {
      release = new Date(releaseDate);
      if (Number.isNaN(release.getTime()))
        throw new FinanceValidationError('releaseDate is not a valid date');
      if (release.getTime() <= Date.now())
        throw new FinanceValidationError('releaseDate must be in the future');
    }
    const row = { reason: reason.trim(), releaseDate: release };
    await this.database.db
      .insert(purchaseInvoiceHold)
      .values({ purchaseInvoiceId, ...row })
      .onConflictDoUpdate({ target: purchaseInvoiceHold.purchaseInvoiceId, set: row });
    return (await this.get(purchaseInvoiceId))!;
  }

  async release(purchaseInvoiceId: string): Promise<void> {
    await this.database.db
      .delete(purchaseInvoiceHold)
      .where(eq(purchaseInvoiceHold.purchaseInvoiceId, purchaseInvoiceId));
  }

  /** Why paying this invoice is blocked right now, or null. */
  async blockReason(purchaseInvoiceId: string): Promise<string | null> {
    const h = await this.get(purchaseInvoiceId);
    if (!h?.active) return null;
    const until = h.releaseDate ? ` حتى ${h.releaseDate.slice(0, 10)}` : '';
    return `فاتورة الشراء موقوفة عن الدفع${until} — السبب: ${h.reason}`;
  }
}
