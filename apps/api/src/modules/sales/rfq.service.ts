import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { PurchaseAllowanceService } from '../settings/purchase-allowance.service';
import { CatalogNotFoundError } from '../catalog/catalog.errors';
import { CatalogService } from '../catalog/catalog.service';
import { CrmNotFoundError } from '../crm/crm.errors';
import { CrmService } from '../crm/crm.service';
import { RfqRepository } from './rfq.repository';
import type { CreateRfqInput, RecordRfqResponseInput, RfqComparison, RfqRecord } from './rfq.types';
import { SalesNotFoundError, SalesValidationError } from './sales.errors';
import { SalesService } from './sales.service';
import type { QuotationRecord } from './sales.types';

/**
 * Request for Quotation to several suppliers (plan item 7): create → send → record each
 * supplier's answer (stored as a normal incoming quotation) → compare → award one supplier.
 */
@Injectable()
export class RfqService {
  constructor(
    private readonly repository: RfqRepository,
    private readonly sales: SalesService,
    private readonly crm: CrmService,
    private readonly catalog: CatalogService,
    @Optional() private readonly allowances?: PurchaseAllowanceService,
  ) {}

  async list(): Promise<RfqRecord[]> { return this.repository.list(); }

  async get(id: string): Promise<RfqRecord> {
    const found = await this.repository.findById(id);
    if (!found) throw new SalesNotFoundError(`RFQ ${id} does not exist`);
    return found;
  }

  async create(input: CreateRfqInput): Promise<RfqRecord> {
    if (!input.lines || input.lines.length === 0) throw new SalesValidationError('an RFQ needs at least one item line');
    const supplierIds = [...new Set(input.supplierIds ?? [])];
    if (supplierIds.length < 2) throw new SalesValidationError('an RFQ goes to at least two different suppliers');
    const itemIds = input.lines.map((l) => l.itemId);
    if (new Set(itemIds).size !== itemIds.length) throw new SalesValidationError('each item may appear only once in an RFQ');
    for (const line of input.lines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new SalesValidationError('line quantity must be positive');
      await this.mustExist(() => this.catalog.getItem(line.itemId), CatalogNotFoundError, `item ${line.itemId} does not exist`);
    }
    for (const supplierId of supplierIds) {
      await this.mustExist(() => this.crm.getSupplier(supplierId), CrmNotFoundError, `supplier ${supplierId} does not exist`);
      const blocked = await this.crm.supplierBlockReason(supplierId, 'rfq');
      if (blocked) throw new SalesValidationError(blocked);
    }
    const sequence = (await this.repository.count()) + 1;
    const rfqNumber = `RFQ-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`;
    return this.repository.insert({ ...input, supplierIds, id: randomUUID(), rfqNumber });
  }

  async send(id: string): Promise<RfqRecord> {
    const found = await this.get(id);
    if (found.status !== 'draft') throw new SalesValidationError(`RFQ ${found.rfqNumber} is "${found.status}" and cannot be sent`);
    await this.repository.setStatus(id, 'sent');
    return this.get(id);
  }

  /** Records a supplier's prices for every RFQ line as a new incoming quotation. */
  async recordResponse(id: string, supplierId: string, input: RecordRfqResponseInput): Promise<{ rfq: RfqRecord; quotation: QuotationRecord }> {
    const found = await this.get(id);
    const invited = this.invitedPending(found, supplierId);
    const prices = new Map<string, string>();
    const quantities = new Map<string, string>();
    for (const line of input.lines ?? []) {
      if (prices.has(line.itemId)) throw new SalesValidationError(`item ${line.itemId} is priced twice`);
      prices.set(line.itemId, line.unitPrice);
      if (line.quantity !== undefined) quantities.set(line.itemId, line.quantity);
    }
    const missing = found.lines.filter((l) => !prices.has(l.itemId));
    const extra = [...prices.keys()].filter((itemId) => !found.lines.some((l) => l.itemId === itemId));
    if (missing.length > 0 || extra.length > 0) {
      throw new SalesValidationError('the response must price exactly the RFQ items (no missing or extra items)');
    }
    // Over-order allowance (plan item 12): a supplier may offer more than requested only within the %.
    if (quantities.size > 0) {
      const pct = this.allowances ? (await this.allowances.resolve(found.orgNodeId)).overOrderPct : 0;
      for (const l of found.lines) {
        const offered = quantities.get(l.itemId);
        if (offered === undefined) continue;
        const q = Number(offered);
        if (!Number.isFinite(q) || q <= 0) throw new SalesValidationError('offered quantity must be positive');
        const max = PurchaseAllowanceService.limit(Number(l.quantity), pct);
        if (q > max + 1e-9) {
          throw new SalesValidationError(`الكمية المعروضة ${q} تتجاوز المطلوب ${Number(l.quantity)} بأكثر من نسبة السماح ${pct}% (الحد ${Number(max.toFixed(4))})`);
        }
      }
    }
    const quotation = await this.sales.createQuotation({
      direction: 'incoming',
      supplierId: invited.supplierId,
      orgNodeId: found.orgNodeId ?? undefined,
      validUntil: input.validUntil,
      note: input.note ?? `رد على طلب عرض الأسعار ${found.rfqNumber}`,
      lines: found.lines.map((l) => ({ itemId: l.itemId, quantity: quantities.get(l.itemId) ?? l.quantity, unitPrice: prices.get(l.itemId)! })),
    });
    await this.repository.setSupplierResponse(id, supplierId, 'received', quotation.id);
    return { rfq: await this.get(id), quotation };
  }

  async recordDecline(id: string, supplierId: string): Promise<RfqRecord> {
    const found = await this.get(id);
    this.invitedPending(found, supplierId);
    await this.repository.setSupplierResponse(id, supplierId, 'declined');
    return this.get(id);
  }

  /** Side-by-side prices per item; the lowest price per line and the lowest complete total are flagged. */
  async compare(id: string): Promise<RfqComparison> {
    const found = await this.get(id);
    const quotations = new Map<string, QuotationRecord>();
    for (const s of found.suppliers) {
      if (s.status === 'received' && s.quotationId) quotations.set(s.supplierId, await this.sales.getQuotation(s.quotationId));
    }
    const totals = new Map<string, number>();
    const lines = found.lines.map((line) => {
      const offers = [...quotations.entries()].flatMap(([supplierId, q]) => {
        const ql = q.lines.find((x) => x.itemId === line.itemId);
        if (!ql) return [];
        const lineTotal = Number(ql.unitPrice) * Number(line.quantity);
        totals.set(supplierId, (totals.get(supplierId) ?? 0) + lineTotal);
        return [{ supplierId, unitPrice: ql.unitPrice, lineTotal: lineTotal.toFixed(4), isLowest: false }];
      });
      const min = Math.min(...offers.map((o) => Number(o.unitPrice)));
      for (const o of offers) o.isLowest = Number(o.unitPrice) === min;
      return { itemId: line.itemId, quantity: line.quantity, offers };
    });
    let lowestTotalSupplierId: string | null = null;
    let lowest = Infinity;
    for (const [supplierId, total] of totals) {
      if (total < lowest) { lowest = total; lowestTotalSupplierId = supplierId; }
    }
    return {
      rfqId: id,
      suppliers: found.suppliers.map((s) => ({
        supplierId: s.supplierId, status: s.status, quotationId: s.quotationId,
        total: totals.has(s.supplierId) ? totals.get(s.supplierId)!.toFixed(4) : null,
      })),
      lines,
      lowestTotalSupplierId,
    };
  }

  /** Approves the chosen supplier's quotation, rejects the other answers and closes the RFQ. */
  async award(id: string, supplierId: string): Promise<RfqRecord> {
    const found = await this.get(id);
    if (found.status !== 'sent') throw new SalesValidationError(`RFQ ${found.rfqNumber} is "${found.status}" and cannot be awarded`);
    const winner = found.suppliers.find((s) => s.supplierId === supplierId);
    if (!winner) throw new SalesValidationError('this supplier was not invited to the RFQ');
    if (winner.status !== 'received' || !winner.quotationId) {
      throw new SalesValidationError('only a supplier who answered the RFQ can be awarded');
    }
    await this.sales.approveQuotation(winner.quotationId);
    for (const other of found.suppliers) {
      if (other.supplierId !== supplierId && other.status === 'received' && other.quotationId) {
        await this.sales.rejectQuotation(other.quotationId);
      }
    }
    await this.repository.setStatus(id, 'closed', supplierId);
    return this.get(id);
  }

  async cancel(id: string): Promise<RfqRecord> {
    const found = await this.get(id);
    if (found.status === 'closed' || found.status === 'cancelled') {
      throw new SalesValidationError(`RFQ ${found.rfqNumber} is already "${found.status}"`);
    }
    await this.repository.setStatus(id, 'cancelled');
    return this.get(id);
  }

  private invitedPending(found: RfqRecord, supplierId: string): RfqRecord['suppliers'][number] {
    if (found.status !== 'sent') throw new SalesValidationError(`RFQ ${found.rfqNumber} must be "sent" to record answers (it is "${found.status}")`);
    const invited = found.suppliers.find((s) => s.supplierId === supplierId);
    if (!invited) throw new SalesValidationError('this supplier was not invited to the RFQ');
    if (invited.status !== 'pending') throw new SalesValidationError(`this supplier already answered ("${invited.status}")`);
    return invited;
  }

  private async mustExist(load: () => Promise<unknown>, notFound: new (...args: never[]) => Error, message: string): Promise<void> {
    try {
      await load();
    } catch (err) {
      if (err instanceof notFound) throw new SalesNotFoundError(message);
      throw err;
    }
  }
}
