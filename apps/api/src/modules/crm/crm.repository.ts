import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { customer, customerInteraction, supplier } from './crm.schema';
import type {
  CreateCustomerInput, CreateInteractionInput, CreateSupplierInput, CustomerInteractionRecord,
  CustomerRecord, CustomerStatus, InteractionType, SupplierRecord, SupplierStatus,
} from './crm.types';

const supplierColumns = {
  id: supplier.id, code: supplier.code, name: supplier.name,
  contactPhone: supplier.contactPhone, contactEmail: supplier.contactEmail,
  orgNodeId: supplier.orgNodeId, status: supplier.status,
  createdAt: supplier.createdAt, updatedAt: supplier.updatedAt,
};
const customerColumns = {
  id: customer.id, code: customer.code, name: customer.name,
  contactPhone: customer.contactPhone, contactEmail: customer.contactEmail,
  orgNodeId: customer.orgNodeId, status: customer.status,
  createdAt: customer.createdAt, updatedAt: customer.updatedAt,
};
const interactionColumns = {
  id: customerInteraction.id, customerId: customerInteraction.customerId,
  interactionType: customerInteraction.interactionType, interactionDate: customerInteraction.interactionDate,
  note: customerInteraction.note, createdAt: customerInteraction.createdAt,
};

interface SupplierRow { id: string; code: string; name: string; contactPhone: string | null; contactEmail: string | null; orgNodeId: string; status: string; createdAt: Date; updatedAt: Date; }
interface CustomerRow { id: string; code: string; name: string; contactPhone: string | null; contactEmail: string | null; orgNodeId: string; status: string; createdAt: Date; updatedAt: Date; }
interface InteractionRow { id: string; customerId: string; interactionType: string; interactionDate: Date; note: string | null; createdAt: Date; }

function toSupplierRecord(row: SupplierRow): SupplierRecord {
  return { id: row.id, code: row.code, name: row.name, contactPhone: row.contactPhone, contactEmail: row.contactEmail,
    orgNodeId: row.orgNodeId, status: row.status as SupplierStatus,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function toCustomerRecord(row: CustomerRow): CustomerRecord {
  return { id: row.id, code: row.code, name: row.name, contactPhone: row.contactPhone, contactEmail: row.contactEmail,
    orgNodeId: row.orgNodeId, status: row.status as CustomerStatus,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function toInteractionRecord(row: InteractionRow): CustomerInteractionRecord {
  return { id: row.id, customerId: row.customerId, interactionType: row.interactionType as InteractionType,
    interactionDate: row.interactionDate.toISOString(), note: row.note, createdAt: row.createdAt.toISOString() };
}

@Injectable()
export class CrmRepository {
  constructor(private readonly database: DatabaseService) {}

  async listSuppliers(): Promise<SupplierRecord[]> {
    const rows = await this.database.db.select(supplierColumns).from(supplier).orderBy(asc(supplier.code));
    return rows.map(toSupplierRecord);
  }
  async findSupplierByCode(code: string): Promise<SupplierRecord | null> {
    const rows = await this.database.db.select(supplierColumns).from(supplier).where(eq(supplier.code, code)).limit(1);
    return rows[0] ? toSupplierRecord(rows[0]) : null;
  }
  async insertSupplier(input: CreateSupplierInput & { id: string }): Promise<SupplierRecord> {
    const rows = await this.database.db.insert(supplier).values({
      id: input.id, code: input.code, name: input.name,
      contactPhone: input.contactPhone ?? null, contactEmail: input.contactEmail ?? null, orgNodeId: input.orgNodeId,
    }).returning(supplierColumns);
    return toSupplierRecord(rows[0]!);
  }

  async listCustomers(): Promise<CustomerRecord[]> {
    const rows = await this.database.db.select(customerColumns).from(customer).orderBy(asc(customer.code));
    return rows.map(toCustomerRecord);
  }
  async findCustomerById(id: string): Promise<CustomerRecord | null> {
    const rows = await this.database.db.select(customerColumns).from(customer).where(eq(customer.id, id)).limit(1);
    return rows[0] ? toCustomerRecord(rows[0]) : null;
  }
  async findCustomerByCode(code: string): Promise<CustomerRecord | null> {
    const rows = await this.database.db.select(customerColumns).from(customer).where(eq(customer.code, code)).limit(1);
    return rows[0] ? toCustomerRecord(rows[0]) : null;
  }
  async insertCustomer(input: CreateCustomerInput & { id: string }): Promise<CustomerRecord> {
    const rows = await this.database.db.insert(customer).values({
      id: input.id, code: input.code, name: input.name,
      contactPhone: input.contactPhone ?? null, contactEmail: input.contactEmail ?? null,
      orgNodeId: input.orgNodeId, status: input.status ?? 'lead',
    }).returning(customerColumns);
    return toCustomerRecord(rows[0]!);
  }
  async setCustomerStatus(id: string, status: CustomerStatus): Promise<CustomerRecord> {
    const rows = await this.database.db.update(customer).set({ status }).where(eq(customer.id, id)).returning(customerColumns);
    return toCustomerRecord(rows[0]!);
  }

  async listInteractions(customerId?: string): Promise<CustomerInteractionRecord[]> {
    const rows = customerId
      ? await this.database.db.select(interactionColumns).from(customerInteraction)
          .where(eq(customerInteraction.customerId, customerId)).orderBy(asc(customerInteraction.interactionDate))
      : await this.database.db.select(interactionColumns).from(customerInteraction).orderBy(asc(customerInteraction.interactionDate));
    return rows.map(toInteractionRecord);
  }
  async insertInteraction(input: CreateInteractionInput & { id: string }): Promise<CustomerInteractionRecord> {
    const rows = await this.database.db.insert(customerInteraction).values({
      id: input.id, customerId: input.customerId, interactionType: input.interactionType,
      interactionDate: input.interactionDate ? new Date(input.interactionDate) : new Date(),
      note: input.note ?? null,
    }).returning(interactionColumns);
    return toInteractionRecord(rows[0]!);
  }
}
