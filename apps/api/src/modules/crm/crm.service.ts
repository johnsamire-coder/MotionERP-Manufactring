import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CrmNotFoundError, CrmValidationError } from './crm.errors';
import { CrmRepository } from './crm.repository';
import type {
  CreateCustomerInput, CreateInteractionInput, CreateSupplierInput,
  CustomerInteractionRecord, CustomerRecord, SupplierRecord,
} from './crm.types';

@Injectable()
export class CrmService {
  constructor(private readonly repository: CrmRepository) {}

  async getSuppliers(): Promise<SupplierRecord[]> { return this.repository.listSuppliers(); }

  async createSupplier(input: CreateSupplierInput): Promise<SupplierRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findSupplierByCode(code);
    if (existing) throw new CrmValidationError(`a supplier with code "${code}" already exists`);
    return this.repository.insertSupplier({
      id: randomUUID(), code, name, contactPhone: input.contactPhone,
      contactEmail: input.contactEmail, orgNodeId: input.orgNodeId,
    });
  }

  async getCustomers(): Promise<CustomerRecord[]> { return this.repository.listCustomers(); }

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
      id: randomUUID(), code, name, contactPhone: input.contactPhone,
      contactEmail: input.contactEmail, orgNodeId: input.orgNodeId, status: input.status ?? 'lead',
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
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) throw new CrmValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  return trimmed;
}
function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new CrmValidationError('name is required');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new CrmValidationError('name must not be blank');
  return trimmed;
}
