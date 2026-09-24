// ============================================================
// Motion ERP — Accrual, Prepaid & Provision Service (Updated)
// Step 77
// ============================================================
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AccrualsRepository } from './accruals.repository';
import { CreateAccrualDto, CreatePrepaidDto, CreateWarrantyProvisionDto } from './accruals.dto';
import { AccruedExpense, PrepaidExpense, WarrantyProvision } from './accrual.schema';
import { AccountingService } from './accounting.service';
import type { JournalEntryRecord } from './accounting.types';
import { postManualJournal } from './manual-journal';

@Injectable()
export class AccrualsService {
  constructor(
    private readonly repo: AccrualsRepository,
    private readonly accounting: AccountingService,
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

  /** Posts the accrual once: Dr expense / Cr accrued liability, dated on the accrual date. */
  async postAccrual(
    id: string,
    _userId: string,
  ): Promise<{ accrual: AccruedExpense; journalEntry: JournalEntryRecord }> {
    const accrual = await this.repo.findAccrualById(id);
    if (!accrual) throw new NotFoundException(`Accrual entry ${id} not found`);
    if (accrual.status !== 'accrued' || accrual.journalEntryId) {
      throw new BadRequestException(
        `Accrual ${accrual.voucherNumber} is "${accrual.status}"${accrual.journalEntryId ? ' and already posted' : ''}`,
      );
    }
    const amount = Number(accrual.amount);
    const journal = await postManualJournal(this.accounting, {
      orgNodeId: accrual.orgNodeId,
      entryDate: accrual.accrualDate.toISOString(),
      description: `استحقاق مصروف ${accrual.voucherNumber}: ${accrual.description}`,
      reference: accrual.voucherNumber,
      sourceEventType: 'accrual_entry',
      idempotencyKey: `accrual-${accrual.id}`,
      lines: [
        { accountId: accrual.expenseAccountId, debit: amount, credit: 0 },
        { accountId: accrual.accruedLiabilityAccountId, debit: 0, credit: amount },
      ],
    });
    const updated = await this.repo.updateAccrualStatus(id, 'accrued', {
      journalEntryId: journal.id,
    });
    return { accrual: updated, journalEntry: journal };
  }

  /** Reverses a posted accrual on the given date: Dr accrued liability / Cr expense. */
  async reverseAccrual(
    id: string,
    reversalDate: string,
    _userId: string,
  ): Promise<{ accrual: AccruedExpense; reversalJournal: JournalEntryRecord }> {
    const accrual = await this.repo.findAccrualById(id);
    if (!accrual) throw new NotFoundException(`Accrual entry ${id} not found`);
    if (accrual.status !== 'accrued' || !accrual.journalEntryId) {
      throw new BadRequestException(
        `Only a posted accrual can be reversed (${accrual.voucherNumber} is "${accrual.status}"${accrual.journalEntryId ? '' : ', not posted'})`,
      );
    }
    const amount = Number(accrual.amount);
    const journal = await postManualJournal(this.accounting, {
      orgNodeId: accrual.orgNodeId,
      entryDate: new Date(reversalDate).toISOString(),
      description: `عكس استحقاق ${accrual.voucherNumber}`,
      reference: accrual.voucherNumber,
      sourceEventType: 'accrual_reversal',
      idempotencyKey: `accrual-reversal-${accrual.id}`,
      lines: [
        { accountId: accrual.accruedLiabilityAccountId, debit: amount, credit: 0 },
        { accountId: accrual.expenseAccountId, debit: 0, credit: amount },
      ],
    });
    const updated = await this.repo.updateAccrualStatus(id, 'reversed', {
      reversalJournalEntryId: journal.id,
      reversalDate: new Date(reversalDate),
    });
    return { accrual: updated, reversalJournal: journal };
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

  /**
   * Amortizes part of a prepaid expense: Dr expense / Cr prepaid asset, for no more than what is
   * left (the journal and the remaining balance always agree).
   */
  async amortizeMonth(
    id: string,
    amount: number,
    _userId: string,
  ): Promise<{ prepaid: PrepaidExpense; journalEntry: JournalEntryRecord }> {
    const prepaid = await this.repo.findPrepaidById(id);
    if (!prepaid) throw new NotFoundException(`Prepaid expense ${id} not found`);
    if (prepaid.status !== 'active')
      throw new BadRequestException(`Prepaid ${prepaid.voucherNumber} is "${prepaid.status}"`);
    const consumed = Number(prepaid.consumedAmount);
    const total = Number(prepaid.totalAmount);
    const step = Math.min(amount, total - consumed);
    if (!(step > 0)) throw new BadRequestException('Nothing left to amortize');
    const newConsumed = consumed + step;
    const newRemaining = total - newConsumed;
    const journal = await postManualJournal(this.accounting, {
      orgNodeId: prepaid.orgNodeId,
      entryDate: new Date().toISOString(),
      description: `إطفاء مصروف مدفوع مقدمًا ${prepaid.voucherNumber}: ${prepaid.description}`,
      reference: prepaid.voucherNumber,
      sourceEventType: 'prepaid_amortization',
      idempotencyKey: `prepaid-${prepaid.id}-${newConsumed.toFixed(4)}`,
      lines: [
        { accountId: prepaid.expenseAccountId, debit: step, credit: 0 },
        { accountId: prepaid.prepaidAssetAccountId, debit: 0, credit: step },
      ],
    });
    const updated = await this.repo.updatePrepaidAmortization(
      id,
      newConsumed.toFixed(4),
      newRemaining.toFixed(4),
      newRemaining <= 0.0001 ? 'fully_consumed' : 'active',
    );
    return { prepaid: updated, journalEntry: journal };
  }

  // ── 3. Warranty Provisions ──────────────────
  /** Recognises a warranty provision: Dr warranty expense / Cr provision liability. */
  async createProvision(
    dto: CreateWarrantyProvisionDto,
    _userId: string,
  ): Promise<WarrantyProvision> {
    const calculatedAmount = (dto.baseAmount * dto.provisionRate) / 100;
    const provisionNumber = `PRV-${Date.now().toString().slice(-6)}`;
    const journal = await postManualJournal(this.accounting, {
      orgNodeId: dto.orgNodeId,
      entryDate: new Date(dto.provisionDate).toISOString(),
      description: `مخصص ضمان ${provisionNumber}: ${dto.description}`,
      reference: provisionNumber,
      sourceEventType: 'warranty_provision',
      idempotencyKey: `provision-${provisionNumber}`,
      lines: [
        { accountId: dto.warrantyExpenseAccountId, debit: calculatedAmount, credit: 0 },
        { accountId: dto.provisionLiabilityAccountId, debit: 0, credit: calculatedAmount },
      ],
    });
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
      notes: [dto.notes, `journal ${journal.entryNumber}`].filter(Boolean).join(' — '),
    });
  }

  /**
   * Uses the provision for a real warranty cost: Dr provision liability / Cr the account the cost
   * came from (cash, bank or stock used for the repair), for no more than what is left.
   */
  async utilizeProvision(
    id: string,
    amount: number,
    creditAccountId: string,
    _userId: string,
  ): Promise<{ provision: WarrantyProvision; utilizationJournal: JournalEntryRecord }> {
    const prv = await this.repo.findProvisionById(id);
    if (!prv) throw new NotFoundException(`Provision ${id} not found`);
    if (prv.status !== 'active')
      throw new BadRequestException(`Provision ${prv.provisionNumber} is "${prv.status}"`);
    const utilized = Number(prv.utilizedAmount);
    const total = Number(prv.provisionAmount);
    const step = Math.min(amount, total - utilized);
    if (!(step > 0)) throw new BadRequestException('Nothing left on this provision');
    const newUtilized = utilized + step;
    const newRemaining = total - newUtilized;
    const journal = await postManualJournal(this.accounting, {
      orgNodeId: prv.orgNodeId,
      entryDate: new Date().toISOString(),
      description: `استخدام مخصص الضمان ${prv.provisionNumber}`,
      reference: prv.provisionNumber,
      sourceEventType: 'provision_utilization',
      idempotencyKey: `provision-use-${prv.id}-${newUtilized.toFixed(4)}`,
      lines: [
        { accountId: prv.provisionLiabilityAccountId, debit: step, credit: 0 },
        { accountId: creditAccountId, debit: 0, credit: step },
      ],
    });
    const updated = await this.repo.updateProvisionStatus(
      id,
      newRemaining <= 0.0001 ? 'fully_utilized' : 'active',
      { utilizedAmount: newUtilized.toFixed(4), remainingAmount: newRemaining.toFixed(4) },
    );
    return { provision: updated, utilizationJournal: journal };
  }
}
