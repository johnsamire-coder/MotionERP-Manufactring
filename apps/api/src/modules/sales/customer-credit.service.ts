import { Injectable, Optional } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { PartyGroupService } from '../crm/party-group.service';
import { CustomerCreditRepository } from './customer-credit.repository';

export interface CustomerCreditStatus {
  customerId: string;
  /** null = no credit limit set. */
  creditLimit: string | null;
  /** Where the limit came from: the customer itself or its group tree (plan item 28). */
  creditLimitSource?: 'customer' | 'group' | null;
  /** Source 1: posted general-ledger balance of the customer. */
  ledgerBalance: string;
  /** Source 2: approved / in-progress job orders not yet invoiced (quotation value − posted invoices). */
  unbilledOrders: string;
  /** Source 3 (informational): delivered deliveries without an invoice; their value is already inside source 2. */
  deliveredNotInvoicedCount: number;
  totalExposure: string;
  /** null when there is no limit. */
  available: string | null;
  exceeded: boolean;
}

/**
 * Composite credit check (plan item 6). Owner decisions: the actual balance comes from the
 * general ledger (so it needs account mappings in place), and exceeding the limit only WARNS.
 */
@Injectable()
export class CustomerCreditService {
  constructor(
    private readonly repository: CustomerCreditRepository,
    private readonly crm: CrmService,
    @Optional() private readonly groups?: PartyGroupService,
  ) {}

  async getStatus(customerId: string): Promise<CustomerCreditStatus> {
    const customer = await this.crm.getCustomer(customerId);
    const ledgerBalance = await this.repository.ledgerBalance(customerId);

    const orders = await this.repository.openJobOrders(customerId);
    let unbilledOrders = 0;
    for (const order of orders) {
      if (!order.quotationReference) continue; // internal / reference-less orders carry no value
      const value = await this.repository.quotationNetValue(order.quotationReference);
      const invoiced = await this.repository.postedInvoicedNet(order.jobOrderNumber);
      unbilledOrders += Math.max(0, value - invoiced);
    }
    const deliveredNotInvoicedCount = await this.repository.deliveredNotInvoicedCount(
      orders.map((o) => o.jobOrderNumber),
    );

    const totalExposure = ledgerBalance + unbilledOrders;
    // Own limit first, else the nearest customer group that sets a default (plan item 28).
    const effective = this.groups
      ? await this.groups.effectiveCreditLimit(customer)
      : {
          limit: customer.creditLimit,
          source: customer.creditLimit === null ? null : ('customer' as const),
        };
    const limit = effective.limit === null ? null : Number(effective.limit);
    return {
      customerId,
      creditLimit: effective.limit,
      creditLimitSource: effective.source,
      ledgerBalance: ledgerBalance.toFixed(4),
      unbilledOrders: unbilledOrders.toFixed(4),
      deliveredNotInvoicedCount,
      totalExposure: totalExposure.toFixed(4),
      available: limit === null ? null : (limit - totalExposure).toFixed(4),
      exceeded: limit !== null && totalExposure > limit,
    };
  }

  /** A warning message when the customer is over the limit, otherwise null. Never blocks. */
  async warningFor(
    customerId: string | null,
  ): Promise<{ message: string; status: CustomerCreditStatus } | null> {
    if (!customerId) return null;
    const status = await this.getStatus(customerId);
    if (!status.exceeded) return null;
    return {
      message:
        `تحذير: العميل تجاوز حد الائتمان — الحد ${status.creditLimit}، الإجمالي ${status.totalExposure} ` +
        `(رصيد الأستاذ ${status.ledgerBalance} + أوامر لم تُفوتر ${status.unbilledOrders})`,
      status,
    };
  }
}
