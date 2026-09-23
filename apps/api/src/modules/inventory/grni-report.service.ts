import { Injectable, Optional } from '@nestjs/common';
import { OrganizationService } from '../organization/organization.service';
import type { OrgTreeNode } from '../organization/organization.types';
import { GrniReportRepository, type ReceivedNotBilledRow } from './grni-report.repository';
import { InventoryAccessService } from './inventory-access.service';

export interface ReceivedNotBilledReport {
  rows: ReceivedNotBilledRow[];
  totalOutstanding: string;
  /** GRNI ledger balance for the company, when an org node is given and a default GRNI account is set. */
  ledger: { accountId: string; balance: string; difference: string } | null;
}

/**
 * "Received not billed" (plan item 14). GRNI postings already existed (receipt: Dr inventory /
 * Cr GRNI; purchase invoice: Dr GRNI / Cr payable); this adds the missing report listing each
 * purchase receipt's outstanding value and reconciling the total with the GRNI ledger balance.
 */
@Injectable()
export class GrniReportService {
  constructor(
    private readonly repository: GrniReportRepository,
    private readonly organization: OrganizationService,
    @Optional() private readonly access?: InventoryAccessService,
  ) {}

  async receivedNotBilled(orgNodeId?: string, includeFullyBilled = false): Promise<ReceivedNotBilledReport> {
    let scope: string[] | null = null;
    if (orgNodeId) {
      const subtree = await this.organization.getSubtree(orgNodeId);
      const ids: string[] = [];
      const walk = (n: OrgTreeNode): void => { ids.push(n.id); n.children.forEach(walk); };
      walk(subtree);
      scope = ids;
    }
    let rows = await this.repository.receipts(scope);
    const allowed = this.access ? await this.access.allowedWarehouseIds() : null;
    if (allowed) rows = rows.filter((r) => allowed.has(r.warehouseId));
    if (!includeFullyBilled) rows = rows.filter((r) => Number(r.outstandingValue) > 0);
    const total = rows.reduce((a, r) => a + Number(r.outstandingValue), 0);
    const ledger = orgNodeId ? await this.repository.ledgerGrniBalance(orgNodeId) : null;
    return {
      rows,
      totalOutstanding: total.toFixed(4),
      ledger: ledger ? { accountId: ledger.accountId, balance: ledger.balance.toFixed(4), difference: (ledger.balance - total).toFixed(4) } : null,
    };
  }
}
