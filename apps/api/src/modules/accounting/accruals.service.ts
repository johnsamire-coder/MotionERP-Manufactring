// ============================================================
// Motion ERP — Accrual, Prepaid & Provision Service (Updated)
// Step 77
// ============================================================
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Optional,
} from '@nestjs/common';
import { AccrualsRepository } from './accruals.repository';
import { CreateAccrualDto, CreatePrepaidDto, CreateWarrantyProvisionDto } from './accruals.dto';
import { AccruedExpense, PrepaidExpense, WarrantyProvision } from './accrual.schema';
import { PostingEngineService } from './posting-engine.service';
import { manualJournalPoster, type PostedJournal } from './manual-journal';

@Injectable()
export class AccrualsService {
  constructor(
    private readonly repo: AccrualsRepository,
    @Optional() @Inject(PostingEngineService) private readonly postingEngine?: PostingEngineService,
  ) {}

  // ── 1. Accrued Expenses ─────────────────────
  async createAccrual(dto: CreateAccrualDto, _userId: string): Promise<AccruedExpense> {
    const voucherNumber = `ACC-${Date.now().toString().slice(-6)}`;

    return this.repo.createAccrual({
      voucherNumber,
      orgNodeId: dto.orgNodeId,
      expenseAccountId: dto.expenseAccountId,
      accruedLiabilityAccountId: dto.accruedLiabilityAccountId,
      accrualDate: new Date(dto.accrualDate),
      amount: dto.amount.toFixed(4),
      description: dto.description,
      status: 'accrued',
      notes: dto.notes || null,
    });
  }

  async postAccrual(
    id: string,
    userId: string,
  ): Promise<{ accrual: AccruedExpense; journalEntry: PostedJournal }> {
    const accrual = await this.repo.findAccrualById(id);
    if (!accrual) throw new NotFoundException(`Accrual entry ${id} not found`);
    if (accrual.status !== 'accrued') {
      throw new BadRequestException(`Cannot post accrual with status '${accrual.status}'`);
    }

    const amountNum = parseFloat(accrual.amount);

    const journalPayload = {
      companyId: accrual.orgNodeId, // Mapping OrgNode as target
      postingDate: accrual.accrualDate.toISOString().split('T')[0],
      referenceType: 'accrual_entry',
      referenceId: accrual.id,
      description: accrual.description,
      createdBy: userId,
      lines: [
        {
          accountId: accrual.expenseAccountId,
          debit: amountNum,
          credit: 0,
          description: `Debit accrued expense ${accrual.voucherNumber}`,
        },
        {
          accountId: accrual.accruedLiabilityAccountId,
          debit: 0,
          credit: amountNum,
          description: `Credit accrued liability ${accrual.voucherNumber}`,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const journalResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(journalPayload)
      : { id: `mock-journal-${Date.now()}`, ...journalPayload };

    const updated = await this.repo.updateAccrualStatus(id, 'accrued', {
      journalEntryId: journalResult.id,
    });
    return { accrual: updated, journalEntry: journalResult };
  }

  async reverseAccrual(
    id: string,
    reversalDate: string,
    userId: string,
  ): Promise<{ accrual: AccruedExpense; reversalJournal: PostedJournal }> {
    const accrual = await this.repo.findAccrualById(id);
    if (!accrual) throw new NotFoundException(`Accrual entry ${id} not found`);

    const amountNum = parseFloat(accrual.amount);

    const reversalPayload = {
      companyId: accrual.orgNodeId,
      postingDate: reversalDate,
      referenceType: 'accrual_reversal',
      referenceId: accrual.id,
      description: `Reversal of ${accrual.voucherNumber}`,
      createdBy: userId,
      lines: [
        {
          accountId: accrual.accruedLiabilityAccountId,
          debit: amountNum,
          credit: 0,
          description: `Debit accrued liability reversal`,
        },
        {
          accountId: accrual.expenseAccountId,
          debit: 0,
          credit: amountNum,
          description: `Credit accrued expense reversal`,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const journalResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(reversalPayload)
      : { id: `mock-rev-journal-${Date.now()}`, ...reversalPayload };

    const updated = await this.repo.updateAccrualStatus(id, 'reversed', {
      reversalJournalEntryId: journalResult.id,
      reversalDate: new Date(reversalDate),
    });
    return { accrual: updated, reversalJournal: journalResult };
  }

  // ── 2. Prepaid Expenses ─────────────────────
  async createPrepaid(dto: CreatePrepaidDto, _userId: string): Promise<PrepaidExpense> {
    const voucherNumber = `PRE-${Date.now().toString().slice(-6)}`;

    return this.repo.createPrepaid({
      voucherNumber,
      orgNodeId: dto.orgNodeId,
      prepaidAssetAccountId: dto.prepaidAssetAccountId,
      expenseAccountId: dto.expenseAccountId,
      paymentDate: new Date(dto.paymentDate),
      coverageStartDate: new Date(dto.coverageStartDate),
      coverageEndDate: new Date(dto.coverageEndDate),
      totalAmount: dto.totalAmount.toFixed(4),
      monthlyAmortization: dto.monthlyAmortization.toFixed(4),
      consumedAmount: '0.0000',
      remainingAmount: dto.totalAmount.toFixed(4),
      status: 'active',
      description: dto.description,
      notes: dto.notes || null,
    });
  }

  async amortizeMonth(
    id: string,
    amount: number,
    userId: string,
  ): Promise<{ prepaid: PrepaidExpense; journalEntry: PostedJournal }> {
    const prepaid = await this.repo.findPrepaidById(id);
    if (!prepaid) throw new NotFoundException(`Prepaid expense ${id} not found`);

    const consumedNum = parseFloat(prepaid.consumedAmount);
    const totalNum = parseFloat(prepaid.totalAmount);

    const newConsumed = Math.min(consumedNum + amount, totalNum);
    const newRemaining = totalNum - newConsumed;
    const newStatus = newRemaining <= 0.0001 ? 'fully_consumed' : 'active';

    const journalPayload = {
      companyId: prepaid.orgNodeId,
      postingDate: new Date().toISOString().split('T')[0],
      referenceType: 'prepaid_amortization',
      referenceId: prepaid.id,
      description: `Amortization: ${prepaid.description}`,
      createdBy: userId,
      lines: [
        {
          accountId: prepaid.expenseAccountId,
          debit: amount,
          credit: 0,
          description: `Amortization expense for ${prepaid.voucherNumber}`,
        },
        {
          accountId: prepaid.prepaidAssetAccountId,
          debit: 0,
          credit: amount,
          description: `Credit prepaid asset for ${prepaid.voucherNumber}`,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const journalResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(journalPayload)
      : { id: `mock-amort-journal-${Date.now()}`, ...journalPayload };

    const updated = await this.repo.updatePrepaidAmortization(
      id,
      newConsumed.toFixed(4),
      newRemaining.toFixed(4),
      newStatus,
    );
    return { prepaid: updated, journalEntry: journalResult };
  }

  // ── 3. Warranty Provisions ──────────────────
  async createProvision(
    dto: CreateWarrantyProvisionDto,
    _userId: string,
  ): Promise<WarrantyProvision> {
    const calculatedAmount = (dto.baseAmount * dto.provisionRate) / 100;
    const provisionNumber = `PRV-${Date.now().toString().slice(-6)}`;

    return this.repo.createProvision({
      provisionNumber,
      orgNodeId: dto.orgNodeId,
      warrantyExpenseAccountId: dto.warrantyExpenseAccountId,
      provisionLiabilityAccountId: dto.provisionLiabilityAccountId,
      provisionDate: new Date(dto.provisionDate),
      salesInvoiceId: dto.salesInvoiceId || null,
      baseAmount: dto.baseAmount.toFixed(4),
      provisionRate: dto.provisionRate.toFixed(2),
      provisionAmount: calculatedAmount.toFixed(4),
      utilizedAmount: '0.0000',
      remainingAmount: calculatedAmount.toFixed(4),
      warrantyExpiryDate: dto.warrantyExpiryDate ? new Date(dto.warrantyExpiryDate) : null,
      status: 'active',
      description: dto.description,
      notes: dto.notes || null,
    });
  }

  async utilizeProvision(
    id: string,
    amount: number,
    userId: string,
  ): Promise<{ provision: WarrantyProvision; utilizationJournal: PostedJournal }> {
    const prv = await this.repo.findProvisionById(id);
    if (!prv) throw new NotFoundException(`Provision ${id} not found`);

    const utilizedNum = parseFloat(prv.utilizedAmount);
    const provisionAmount = parseFloat(prv.provisionAmount);

    const newUtilized = Math.min(utilizedNum + amount, provisionAmount);
    const newRemaining = provisionAmount - newUtilized;
    const newStatus = newRemaining <= 0.0001 ? 'fully_utilized' : 'active';

    const journalPayload = {
      companyId: prv.orgNodeId,
      postingDate: new Date().toISOString().split('T')[0],
      referenceType: 'provision_utilization',
      referenceId: prv.id,
      description: `Utilization of ${prv.provisionNumber}`,
      createdBy: userId,
      lines: [
        {
          accountId: prv.provisionLiabilityAccountId,
          debit: amount,
          credit: 0,
          description: `Debit provision liability`,
        },
        {
          accountId: prv.warrantyExpenseAccountId,
          debit: 0,
          credit: amount,
          description: `Credit consumed warranty cost`,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const journalResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(journalPayload)
      : { id: `mock-prv-util-${Date.now()}`, ...journalPayload };

    const updated = await this.repo.updateProvisionStatus(id, newStatus, {
      utilizedAmount: newUtilized.toFixed(4),
      remainingAmount: newRemaining.toFixed(4),
    });

    return { provision: updated, utilizationJournal: journalResult };
  }
}
