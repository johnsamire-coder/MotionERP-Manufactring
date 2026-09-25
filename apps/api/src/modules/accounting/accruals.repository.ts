// ============================================================
// Motion ERP — Accrual, Prepaid & Provision Repository (Updated)
// Step 77
// ============================================================
import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  accruedExpense,
  prepaidExpense,
  warrantyProvision,
  AccruedExpense,
  PrepaidExpense,
  WarrantyProvision,
} from './accrual.schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class AccrualsRepository {
  constructor(@Inject('DRIZZLE') private readonly db: NodePgDatabase) {}

  // ── 1. Accrued Expenses ─────────────────────
  async createAccrual(data: typeof accruedExpense.$inferInsert): Promise<AccruedExpense> {
    const [result] = await this.db.insert(accruedExpense).values(data).returning();
    return result!;
  }

  async findAccrualById(id: string): Promise<AccruedExpense | null> {
    const [result] = await this.db.select().from(accruedExpense).where(eq(accruedExpense.id, id));
    return result || null;
  }

  async updateAccrualStatus(
    id: string,
    status: 'accrued' | 'reversed' | 'cancelled',
    updateObj?: Partial<typeof accruedExpense.$inferInsert>,
  ): Promise<AccruedExpense> {
    const [result] = await this.db
      .update(accruedExpense)
      .set({ status, updatedAt: new Date(), ...updateObj })
      .where(eq(accruedExpense.id, id))
      .returning();
    return result!;
  }

  // ── 2. Prepaid Expenses ─────────────────────
  async createPrepaid(data: typeof prepaidExpense.$inferInsert): Promise<PrepaidExpense> {
    const [result] = await this.db.insert(prepaidExpense).values(data).returning();
    return result!;
  }

  async findPrepaidById(id: string): Promise<PrepaidExpense | null> {
    const [result] = await this.db.select().from(prepaidExpense).where(eq(prepaidExpense.id, id));
    return result || null;
  }

  async updatePrepaidAmortization(
    id: string,
    consumedAmount: string,
    remainingAmount: string,
    status: 'active' | 'fully_consumed',
  ): Promise<PrepaidExpense> {
    const [result] = await this.db
      .update(prepaidExpense)
      .set({
        consumedAmount,
        remainingAmount,
        status,
        updatedAt: new Date(),
      })
      .where(eq(prepaidExpense.id, id))
      .returning();
    return result!;
  }

  // ── 3. Warranty Provisions ──────────────────
  async createProvision(data: typeof warrantyProvision.$inferInsert): Promise<WarrantyProvision> {
    const [result] = await this.db.insert(warrantyProvision).values(data).returning();
    return result!;
  }

  async findProvisionById(id: string): Promise<WarrantyProvision | null> {
    const [result] = await this.db
      .select()
      .from(warrantyProvision)
      .where(eq(warrantyProvision.id, id));
    return result || null;
  }

  async updateProvisionStatus(
    id: string,
    status: 'active' | 'fully_utilized' | 'expired' | 'cancelled',
    updateObj?: Partial<typeof warrantyProvision.$inferInsert>,
  ): Promise<WarrantyProvision> {
    const [result] = await this.db
      .update(warrantyProvision)
      .set({ status, updatedAt: new Date(), ...updateObj })
      .where(eq(warrantyProvision.id, id))
      .returning();
    return result!;
  }
}
