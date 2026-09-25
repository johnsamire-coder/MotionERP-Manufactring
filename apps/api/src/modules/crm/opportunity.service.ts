import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CrmNotFoundError, CrmValidationError } from './crm.errors';
import { CrmRepository } from './crm.repository';
import { OpportunityRepository } from './opportunity.repository';
import type {
  CreateOpportunityInput,
  OpportunityRecord,
  OpportunityStage,
} from './opportunity.types';

/** Allowed manual stage moves (quoted / won are reached through quotations). */
const MANUAL_MOVES: Record<OpportunityStage, OpportunityStage[]> = {
  open: ['qualified', 'lost'],
  qualified: ['open', 'lost'],
  quoted: ['lost'],
  won: [],
  lost: ['open'],
};

/** Opportunity (plan item 17): the stage between an interested lead and a formal quotation. */
@Injectable()
export class OpportunityService {
  constructor(
    private readonly repository: OpportunityRepository,
    private readonly crm: CrmRepository,
  ) {}

  async list(customerId?: string): Promise<OpportunityRecord[]> {
    return this.repository.list(customerId);
  }

  async get(id: string): Promise<OpportunityRecord> {
    const found = await this.repository.findById(id);
    if (!found) throw new CrmNotFoundError(`opportunity ${id} does not exist`);
    return found;
  }

  async create(input: CreateOpportunityInput): Promise<OpportunityRecord> {
    const customer = await this.crm.findCustomerById(input.customerId);
    if (!customer) throw new CrmNotFoundError(`customer ${input.customerId} does not exist`);
    if (customer.status === 'archived' || customer.status === 'inactive') {
      throw new CrmValidationError(`customer ${customer.code} is "${customer.status}"`);
    }
    if (!input.title?.trim()) throw new CrmValidationError('title is required');
    const p = input.probability ?? 10;
    if (!Number.isInteger(p) || p < 0 || p > 100)
      throw new CrmValidationError('probability must be 0–100');
    for (const i of input.items ?? []) {
      if (!(Number(i.quantity) > 0)) throw new CrmValidationError('item quantity must be positive');
    }
    const n = (await this.repository.count()) + 1;
    const opportunityNumber = `OPP-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`;
    return this.repository.insert({
      ...input,
      title: input.title.trim(),
      id: randomUUID(),
      opportunityNumber,
    });
  }

  async moveStage(
    id: string,
    stage: OpportunityStage,
    lostReason?: string,
  ): Promise<OpportunityRecord> {
    const opp = await this.get(id);
    if (!MANUAL_MOVES[opp.stage].includes(stage)) {
      throw new CrmValidationError(
        `cannot move opportunity ${opp.opportunityNumber} from "${opp.stage}" to "${stage}"`,
      );
    }
    if (stage === 'lost' && !lostReason?.trim())
      throw new CrmValidationError('lostReason is required to mark an opportunity lost');
    return this.repository.update(id, {
      stage,
      lostReason: stage === 'lost' ? lostReason!.trim() : null,
    });
  }

  /** Called by the sales module once a quotation was created from the opportunity. */
  async markQuoted(id: string, quotationId: string): Promise<OpportunityRecord> {
    const opp = await this.get(id);
    if (opp.stage !== 'open' && opp.stage !== 'qualified') {
      throw new CrmValidationError(
        `opportunity ${opp.opportunityNumber} is "${opp.stage}" and cannot be quoted`,
      );
    }
    return this.repository.update(id, {
      stage: 'quoted',
      quotationId,
      probability: Math.max(opp.probability, 50),
    });
  }

  /** Called when a quotation is approved: its opportunity (if any) is won. */
  async markWonByQuotation(quotationId: string): Promise<OpportunityRecord | null> {
    const opp = await this.repository.findByQuotation(quotationId);
    if (!opp || opp.stage === 'won') return opp;
    return this.repository.update(opp.id, { stage: 'won', probability: 100 });
  }
}
