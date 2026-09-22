// ============================================================
// Motion ERP — Egyptian Tax Authority & Customs Schema
// Step 74 | VAT Settlement, WHT Form 41 & Customs Declarations
// ============================================================
import {
  pgSchema,
  uuid,
  text,
  numeric,
  date,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';

export const taxSchema = pgSchema('tax');

// ── Enums ────────────────────────────────────
export const taxSettlementStatusEnum = taxSchema.enum('tax_settlement_status', [
  'draft',        // مسودة تسوية
  'filed',        // تم تقديم الإقرار الضريبي
  'paid',         // تم السداد لمصلحة الضرائب
]);

export const whtDirectionEnum = taxSchema.enum('wht_direction', [
  'deducted_by_us',   // خصم خصمناه من الموردين ونورده لمصلحة الضرائب (1% أو 3%)
  'deducted_from_us', // خصم خصمته المستشفيات والعملاء من مستحقاتنا
]);

export const whtStatusEnum = taxSchema.enum('wht_status', [
  'recorded',   // مثبت بالدفاتر
  'declared',   // مدرج في نموذج 41 ربع سنوي
  'settled',    // تم سداده / تسويته
]);

export const customsStatusEnum = taxSchema.enum('customs_status', [
  'draft',        // تحت الإجراء الجمركي
  'cleared',      // تم الإفراج الجمركي وسداد الرسوم
  'capitalized',  // تمت رسملة الرسوم على تكلفة الصاج والمخزون
]);

// ── 1. تسوية ضريبة القيمة المضافة (VAT Return) ──
// القيد: Dr Output VAT (ضريبة مبيعات)
//       Cr Input VAT (ضريبة مدخلات)
//       Cr Tax Authority Payable (المستحق لمصلحة الضرائب)
export const taxSettlement = taxSchema.table('tax_settlement', {
  id:                 uuid('id').defaultRandom().primaryKey(),
  settlementNumber:   text('settlement_number').notNull().unique(),
  companyId:          uuid('company_id').notNull(),
  fiscalYearId:       uuid('fiscal_year_id').notNull(),
  periodId:           uuid('period_id').notNull(),
  taxPeriod:          text('tax_period').notNull(), // مثلا: "2026-08"

  // الأرقام الضريبية
  totalSalesTaxable:  numeric('total_sales_taxable', { precision: 18, scale: 4 }).notNull(),
  outputVatAmount:    numeric('output_vat_amount', { precision: 18, scale: 4 }).notNull(),   // 14% مخرجات
  totalPurchaseTaxable:numeric('total_purchase_taxable', { precision: 18, scale: 4 }).notNull(),
  inputVatAmount:     numeric('input_vat_amount', { precision: 18, scale: 4 }).notNull(),    // 14% مدخلات
  netVatPayable:      numeric('net_vat_payable', { precision: 18, scale: 4 }).notNull(),     // الصافي المستحق

  // حالة وسداد الإقرار
  status:             taxSettlementStatusEnum('status').default('draft').notNull(),
  paymentReference:   text('payment_reference'),
  paymentDate:        date('payment_date'),
  journalEntryId:     uuid('journal_entry_id'),

  // Audit
  createdBy:          uuid('created_by').notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 2. ضريبة الخصم والإضافة (نموذج 41 ضرائب) ──
// توريدات خامات صاج: 1% | خدمات وتشغيل خارجي ودهانات: 3%
export const withholdingTaxEntry = taxSchema.table('withholding_tax_entry', {
  id:                 uuid('id').defaultRandom().primaryKey(),
  entryNumber:        text('entry_number').notNull().unique(),
  companyId:          uuid('company_id').notNull(),
  fiscalYearId:       uuid('fiscal_year_id').notNull(),
  quarter:            integer('quarter').notNull(), // 1, 2, 3, 4
  entryDate:          date('entry_date').notNull(),

  // جهة التعامل
  direction:          whtDirectionEnum('direction').notNull(),
  partnerId:          uuid('partner_id').notNull(),
  partnerName:        text('partner_name').notNull(),
  taxRegistrationNum: text('tax_registration_num').notNull(), // رقم التسجيل الضريبي للشركة/المورد

  // الفاتورة والنسب
  invoiceId:          uuid('invoice_id'),
  invoiceNumber:      text('invoice_number').notNull(),
  baseAmount:         numeric('base_amount', { precision: 18, scale: 4 }).notNull(),
  whtRate:            numeric('wht_rate', { precision: 5, scale: 2 }).notNull(), // 1.00% أو 3.00%
  whtAmount:          numeric('wht_amount', { precision: 18, scale: 4 }).notNull(),

  // الحالة
  status:             whtStatusEnum('status').default('recorded').notNull(),
  form41BatchNumber:  text('form41_batch_number'),
  journalEntryId:     uuid('journal_entry_id'),

  // Audit
  createdBy:          uuid('created_by').notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 3. الإفراج الجمركي ومشمول الشهادات (Customs) ─
// تسجيل الرسوم الجمركية ورسم التنمية وضريبة القيمة المضافة لرسملتها على الواردات
export const customsDeclaration = taxSchema.table('customs_declaration', {
  id:                 uuid('id').defaultRandom().primaryKey(),
  declarationNumber:  text('declaration_number').notNull().unique(), // رقم الشهادة 46 ك.م
  companyId:          uuid('company_id').notNull(),
  fiscalYearId:       uuid('fiscal_year_id').notNull(),
  periodId:           uuid('period_id').notNull(),
  declarationDate:    date('declaration_date').notNull(),

  // بيانات الشحنة والميناء
  portName:           text('port_name').notNull(),           // ميناء الإسكندرية / السخنة
  billOfLading:       text('bill_of_lading').notNull(),      // رقم البوليصة B/L
  supplierName:       text('supplier_name').notNull(),
  currency:           text('currency').default('USD').notNull(),
  exchangeRate:       numeric('exchange_rate', { precision: 12, scale: 4 }).notNull(),
  cifValueForeign:    numeric('cif_value_foreign', { precision: 18, scale: 4 }).notNull(),
  cifValueEgp:        numeric('cif_value_egp', { precision: 18, scale: 4 }).notNull(),

  // الرسوم المسددة بالجمارك
  customsDutyAmount:  numeric('customs_duty_amount', { precision: 18, scale: 4 }).notNull(), // جمارك
  developmentFee:     numeric('development_fee', { precision: 18, scale: 4 }).default('0').notNull(), // رسم تنمية
  vatPaidAtCustoms:   numeric('vat_paid_at_customs', { precision: 18, scale: 4 }).notNull(), // 14% تسدد بالجمارك (تسترد كمدخلات)
  clearanceExpenses:  numeric('clearance_expenses', { precision: 18, scale: 4 }).default('0').notNull(), // مصاريف تخليص
  totalPaidAmount:    numeric('total_paid_amount', { precision: 18, scale: 4 }).notNull(),

  // الحالة والربط مع تكلفة المخزون
  status:             customsStatusEnum('status').default('draft').notNull(),
  landedCostVoucherId:uuid('landed_cost_voucher_id'),
  journalEntryId:     uuid('journal_entry_id'),

  // Audit
  createdBy:          uuid('created_by').notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Type Exports ─────────────────────────────
export type TaxSettlement       = typeof taxSettlement.$inferSelect;
export type NewTaxSettlement    = typeof taxSettlement.$inferInsert;
export type WithholdingTaxEntry = typeof withholdingTaxEntry.$inferSelect;
export type NewWithholdingTaxEntry = typeof withholdingTaxEntry.$inferInsert;
export type CustomsDeclaration  = typeof customsDeclaration.$inferSelect;
export type NewCustomsDeclaration = typeof customsDeclaration.$inferInsert;