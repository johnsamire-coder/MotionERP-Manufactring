import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CrmNotFoundError, CrmValidationError } from './crm.errors';
import { CrmRepository } from './crm.repository';
import type {
  CreateCustomerInput,
  CreateInteractionInput,
  CreateSupplierInput,
  CustomerInteractionRecord,
  CustomerRecord,
  SupplierAction,
  SupplierHoldType,
  SupplierRecord,
} from './crm.types';

const HOLD_TYPES: readonly SupplierHoldType[] = ['all', 'invoices', 'payments'];
const HOLD_LABEL: Record<SupplierHoldType, string> = {
  all: 'إيقاف كامل',
  invoices: 'منع الفواتير',
  payments: 'منع المدفوعات',
};

@Injectable()
export class CrmService {
  constructor(private readonly repository: CrmRepository) {}

  async getSuppliers(): Promise<SupplierRecord[]> {
    return this.repository.listSuppliers();
  }

  /**
   * Puts a supplier on hold (plan item 8) or lifts it (holdType null). An optional release
   * date lifts the hold automatically once reached (checked on every use, no job needed).
   */
  async setSupplierHold(
    id: string,
    input: { holdType: SupplierHoldType | null; reason?: string; releaseDate?: string },
  ): Promise<SupplierRecord> {
    await this.getSupplier(id);
    if (input.holdType === null) {
      return this.repository.setSupplierHold(id, {
        holdType: null,
        holdReason: null,
        holdReleaseDate: null,
      });
    }
    if (!HOLD_TYPES.includes(input.holdType))
      throw new CrmValidationError(`holdType must be one of: ${HOLD_TYPES.join(', ')}`);
    let releaseDate: Date | null = null;
    if (input.releaseDate) {
      releaseDate = new Date(input.releaseDate);
      if (Number.isNaN(releaseDate.getTime()))
        throw new CrmValidationError('releaseDate is not a valid date');
      if (releaseDate.getTime() <= Date.now())
        throw new CrmValidationError('releaseDate must be in the future');
    }
    return this.repository.setSupplierHold(id, {
      holdType: input.holdType,
      holdReason: input.reason?.trim() || null,
      holdReleaseDate: releaseDate,
    });
  }

  /** The hold in force right now, or null (no hold, or its release date has passed). */
  effectiveHold(s: SupplierRecord, at: Date = new Date()): SupplierHoldType | null {
    if (!s.holdType) return null;
    if (s.holdReleaseDate && new Date(s.holdReleaseDate).getTime() <= at.getTime()) return null;
    return s.holdType;
  }

  /**
   * Why this purchasing action is blocked for the supplier, or null when allowed.
   * Callers raise their own module error with the message (keeps their HTTP mapping).
   */
  async supplierBlockReason(supplierId: string, action: SupplierAction): Promise<string | null> {
    const s = await this.repository.findSupplierById(supplierId);
    if (!s) return null;
    const hold = this.effectiveHold(s);
    if (!hold) return null;
    const blocked =
      hold === 'all' ||
      (hold === 'invoices' && action === 'invoice') ||
      (hold === 'payments' && action === 'payment');
    if (!blocked) return null;
    const until = s.holdReleaseDate ? ` حتى ${s.holdReleaseDate.slice(0, 10)}` : '';
    const why = s.holdReason ? ` — السبب: ${s.holdReason}` : '';
    return `المورد "${s.name}" موقوف (${HOLD_LABEL[hold]})${until}${why}`;
  }

  async getSupplier(id: string): Promise<SupplierRecord> {
    const found = await this.repository.findSupplierById(id);
    if (!found) throw new CrmNotFoundError(`supplier ${id} does not exist`);
    return found;
  }

  async createSupplier(input: CreateSupplierInput): Promise<SupplierRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findSupplierByCode(code);
    if (existing) throw new CrmValidationError(`a supplier with code "${code}" already exists`);
    return this.repository.insertSupplier({
      id: randomUUID(),
      code,
      name,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      orgNodeId: input.orgNodeId,
    });
  }

  async getCustomers(): Promise<CustomerRecord[]> {
    return this.repository.listCustomers();
  }

  async getCustomer(id: string): Promise<CustomerRecord> {
    const found = await this.repository.findCustomerById(id);
    if (!found) throw new CrmNotFoundError(`customer ${id} does not exist`);
    return found;
  }

  /** Both a real customer and a lead go through the same creation path (D37): the only difference is `status`. */
  async createCustomer(input: CreateCustomerInput): Promise<CustomerRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findCustomerByCode(code);
    if (existing) throw new CrmValidationError(`a customer with code "${code}" already exists`);
    return this.repository.insertCustomer({
      id: randomUUID(),
      code,
      name,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      orgNodeId: input.orgNodeId,
      status: input.status ?? 'lead',
      creditLimit: normalizeCreditLimit(input.creditLimit),
    });
  }

  /**
   * Promotes a lead to an active customer. Called by this unit directly (manual
   * promotion) or, later, automatically by the quotation unit the first time
   * one of the customer's quotations is approved — via this same public method,
   * never by another unit writing to the customer table directly (D2/D20).
   */
  async promoteToActive(id: string): Promise<CustomerRecord> {
    const customer = await this.repository.findCustomerById(id);
    if (!customer) throw new CrmNotFoundError(`customer ${id} does not exist`);
    if (customer.status !== 'lead') return customer;
    return this.repository.setCustomerStatus(id, 'active');
  }

  /** Sets or clears (null) the customer's credit limit (plan item 6). */
  async setCreditLimit(id: string, creditLimit: string | null): Promise<CustomerRecord> {
    const found = await this.repository.findCustomerById(id);
    if (!found) throw new CrmNotFoundError(`customer ${id} does not exist`);
    return this.repository.setCustomerCreditLimit(id, normalizeCreditLimit(creditLimit));
  }

  async getInteractions(customerId?: string): Promise<CustomerInteractionRecord[]> {
    return this.repository.listInteractions(customerId);
  }

  async logInteraction(input: CreateInteractionInput): Promise<CustomerInteractionRecord> {
    const customer = await this.repository.findCustomerById(input.customerId);
    if (!customer) throw new CrmNotFoundError(`customer ${input.customerId} does not exist`);
    return this.repository.insertInteraction({ id: randomUUID(), ...input });
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new CrmValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed))
    throw new CrmValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  return trimmed;
}
function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new CrmValidationError('name is required');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new CrmValidationError('name must not be blank');
  return trimmed;
}

function normalizeCreditLimit(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0)
    throw new CrmValidationError('creditLimit must be a non-negative number');
  return n.toFixed(4);
}
