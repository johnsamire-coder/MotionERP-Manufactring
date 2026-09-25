import { Injectable } from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { OrganizationService } from '../organization/organization.service';
import { OrgNodeNotFoundError } from '../organization/organization.errors';
import { SettingsNotFoundError, SettingsValidationError } from './settings.errors';
import { purchaseAllowance } from './settings.schema';

export interface PurchaseAllowances {
  /** Where the values came from: an org node id, 'global', or 'none' (all zero). */
  source: string;
  overOrderPct: number;
  overReceiptPct: number;
  overBillingPct: number;
}
export type AllowanceKind = 'order' | 'receipt' | 'billing';

/** Purchasing over-allowances (plan item 12): stored per org node or globally, nearest wins. */
@Injectable()
export class PurchaseAllowanceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly organization: OrganizationService,
  ) {}

  /** Effective allowances for an org node: its own row, else the nearest ancestor's, else global, else 0. */
  async resolve(orgNodeId?: string | null): Promise<PurchaseAllowances> {
    if (orgNodeId) {
      const { node, ancestors } = await this.orgNodeOrThrow(() =>
        this.organization.getAncestors(orgNodeId),
      );
      for (const id of [node.id, ...ancestors.map((a) => a.id).reverse()]) {
        const row = await this.find(id);
        if (row) return row;
      }
    }
    return (
      (await this.find(null)) ?? {
        source: 'none',
        overOrderPct: 0,
        overReceiptPct: 0,
        overBillingPct: 0,
      }
    );
  }

  async set(
    orgNodeId: string | null,
    values: { overOrderPct: number; overReceiptPct: number; overBillingPct: number },
  ): Promise<PurchaseAllowances> {
    for (const v of [values.overOrderPct, values.overReceiptPct, values.overBillingPct]) {
      if (!Number.isFinite(v) || v < 0 || v > 100)
        throw new SettingsValidationError('allowances must be between 0 and 100 percent');
    }
    if (orgNodeId) await this.orgNodeOrThrow(() => this.organization.getNode(orgNodeId));
    const row = {
      overOrderPct: values.overOrderPct.toFixed(2),
      overReceiptPct: values.overReceiptPct.toFixed(2),
      overBillingPct: values.overBillingPct.toFixed(2),
      updatedAt: new Date(),
    };
    await this.database.db
      .insert(purchaseAllowance)
      .values({ orgNodeId, ...row })
      .onConflictDoUpdate({ target: purchaseAllowance.orgNodeId, set: row });
    return (await this.find(orgNodeId))!;
  }

  /** The largest quantity/amount allowed against a base, e.g. ordered 100 with 10% → 110. */
  static limit(base: number, pct: number): number {
    return base * (1 + pct / 100);
  }

  private async orgNodeOrThrow<T>(load: () => Promise<T>): Promise<T> {
    try {
      return await load();
    } catch (err) {
      if (err instanceof OrgNodeNotFoundError) throw new SettingsNotFoundError(err.message);
      throw err;
    }
  }

  private async find(orgNodeId: string | null): Promise<PurchaseAllowances | null> {
    const rows = await this.database.db
      .select()
      .from(purchaseAllowance)
      .where(
        orgNodeId
          ? eq(purchaseAllowance.orgNodeId, orgNodeId)
          : isNull(purchaseAllowance.orgNodeId),
      )
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      source: r.orgNodeId ?? 'global',
      overOrderPct: Number(r.overOrderPct),
      overReceiptPct: Number(r.overReceiptPct),
      overBillingPct: Number(r.overBillingPct),
    };
  }
}
