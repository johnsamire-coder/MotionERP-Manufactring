import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { collection, retention } from './finance.schema';
import type { CollectionRecord, CollectionStatus, CreateCollectionInput, CreateRetentionInput, PaymentMethod, RetentionRecord, RetentionStatus } from './finance.types';

const colColumns = {
  id: collection.id, jobOrderReference: collection.jobOrderReference, collectionNumber: collection.collectionNumber,
  collectionDate: collection.collectionDate, amount: collection.amount, currencyCode: collection.currencyCode,
  paymentMethod: collection.paymentMethod, referenceNumber: collection.referenceNumber, notes: collection.notes, status: collection.status,
};
const retColumns = {
  id: retention.id, jobOrderReference: retention.jobOrderReference, retentionNumber: retention.retentionNumber,
  originalAmount: retention.originalAmount, releasedAmount: retention.releasedAmount, currencyCode: retention.currencyCode,
  startDate: retention.startDate, releaseDate: retention.releaseDate, dueDate: retention.dueDate, status: retention.status, notes: retention.notes,
};

interface ColRow {
  id: string; jobOrderReference: string; collectionNumber: string; collectionDate: Date; amount: string;
  currencyCode: string; paymentMethod: string; referenceNumber: string | null; notes: string | null; status: string;
}
interface RetRow {
  id: string; jobOrderReference: string; retentionNumber: string; originalAmount: string; releasedAmount: string;
  currencyCode: string; startDate: Date; releaseDate: Date | null; dueDate: Date; status: string; notes: string | null;
}

function toColRecord(row: ColRow): CollectionRecord {
  return { id: row.id, jobOrderReference: row.jobOrderReference, collectionNumber: row.collectionNumber,
    collectionDate: row.collectionDate.toISOString(), amount: row.amount, currencyCode: row.currencyCode,
    paymentMethod: row.paymentMethod as PaymentMethod, referenceNumber: row.referenceNumber, notes: row.notes, status: row.status as CollectionStatus };
}
function toRetRecord(row: RetRow): RetentionRecord {
  return { id: row.id, jobOrderReference: row.jobOrderReference, retentionNumber: row.retentionNumber,
    originalAmount: row.originalAmount, releasedAmount: row.releasedAmount, currencyCode: row.currencyCode,
    startDate: row.startDate.toISOString(), releaseDate: row.releaseDate ? row.releaseDate.toISOString() : null,
    dueDate: row.dueDate.toISOString(), status: row.status as RetentionStatus, notes: row.notes };
}

@Injectable()
export class FinanceRepository {
  constructor(private readonly database: DatabaseService) {}

  async listCollections(jobOrderReference?: string): Promise<CollectionRecord[]> {
    const rows = jobOrderReference
      ? await this.database.db.select(colColumns).from(collection).where(eq(collection.jobOrderReference, jobOrderReference)).orderBy(asc(collection.collectionDate))
      : await this.database.db.select(colColumns).from(collection).orderBy(asc(collection.collectionDate));
    return rows.map(toColRecord);
  }
  async countCollections(): Promise<number> {
    const rows = await this.database.db.select({ id: collection.id }).from(collection);
    return rows.length;
  }
  async insertCollection(input: CreateCollectionInput & { id: string; collectionNumber: string }): Promise<CollectionRecord> {
    const rows = await this.database.db.insert(collection).values({
      id: input.id, jobOrderReference: input.jobOrderReference, collectionNumber: input.collectionNumber,
      collectionDate: input.collectionDate ? new Date(input.collectionDate) : new Date(),
      amount: input.amount, currencyCode: input.currencyCode ?? 'EGP', paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber ?? null, notes: input.notes ?? null,
    }).returning(colColumns);
    return toColRecord(rows[0]!);
  }

  async listRetentions(jobOrderReference?: string): Promise<RetentionRecord[]> {
    const rows = jobOrderReference
      ? await this.database.db.select(retColumns).from(retention).where(eq(retention.jobOrderReference, jobOrderReference)).orderBy(asc(retention.dueDate))
      : await this.database.db.select(retColumns).from(retention).orderBy(asc(retention.dueDate));
    return rows.map(toRetRecord);
  }
  async findRetentionById(id: string): Promise<RetentionRecord | null> {
    const rows = await this.database.db.select(retColumns).from(retention).where(eq(retention.id, id)).limit(1);
    return rows[0] ? toRetRecord(rows[0]) : null;
  }
  async countRetentions(): Promise<number> {
    const rows = await this.database.db.select({ id: retention.id }).from(retention);
    return rows.length;
  }
  async insertRetention(input: CreateRetentionInput & { id: string; retentionNumber: string }): Promise<RetentionRecord> {
    const rows = await this.database.db.insert(retention).values({
      id: input.id, jobOrderReference: input.jobOrderReference, retentionNumber: input.retentionNumber,
      originalAmount: input.originalAmount, currencyCode: input.currencyCode ?? 'EGP',
      startDate: input.startDate ? new Date(input.startDate) : new Date(), dueDate: new Date(input.dueDate), notes: input.notes ?? null,
    }).returning(retColumns);
    return toRetRecord(rows[0]!);
  }
  async releaseRetention(id: string, releasedAmount: string, status: RetentionStatus): Promise<RetentionRecord> {
    const rows = await this.database.db.update(retention).set({
      releasedAmount, releaseDate: new Date(), status,
    }).where(eq(retention.id, id)).returning(retColumns);
    return toRetRecord(rows[0]!);
  }
}
