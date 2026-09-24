import {
  VOUCHER_TYPES,
  voucherTypeForSource,
  voucherTypeProblem,
  type VoucherLine,
} from './voucher-types';

describe('Journal entry types (plan item 34)', () => {
  const l = (role: VoucherLine['role'], extra: Partial<VoucherLine> = {}): VoucherLine => ({
    role,
    accountId: role ?? 'plain',
    hasParty: false,
    ...extra,
  });

  it('1. seventeen types', () => {
    expect(Object.keys(VOUCHER_TYPES)).toHaveLength(17);
  });

  it('2. bank / cash / contra', () => {
    expect(voucherTypeProblem('bank_entry', [l('cash'), l(null)])).toMatch(/قيد بنك/);
    expect(voucherTypeProblem('bank_entry', [l('bank'), l(null)])).toBeNull();
    expect(voucherTypeProblem('cash_entry', [l('cash'), l(null)])).toBeNull();
    expect(voucherTypeProblem('contra_entry', [l('bank'), l(null)])).toMatch(/بنك أو خزينة بس/);
    expect(voucherTypeProblem('contra_entry', [l('bank'), l('cash')])).toBeNull();
  });

  it('3. notes need a party; opening refuses P&L; depreciation needs both sides', () => {
    expect(voucherTypeProblem('credit_note', [l(null), l(null)])).toMatch(/طرف/);
    expect(
      voucherTypeProblem('credit_note', [l('receivable', { hasParty: true }), l(null)]),
    ).toBeNull();
    expect(voucherTypeProblem('opening_entry', [l('cash'), l('direct_income')])).toMatch(
      /الإيرادات والمصروفات/,
    );
    expect(voucherTypeProblem('opening_entry', [l('cash'), l('equity')])).toBeNull();
    expect(voucherTypeProblem('depreciation_entry', [l('depreciation'), l(null)])).toMatch(
      /مجمع إهلاك/,
    );
    expect(
      voucherTypeProblem('depreciation_entry', [l('depreciation'), l('accumulated_depreciation')]),
    ).toBeNull();
  });

  it('4. write-off / exchange use the company default when set; inter-company needs a reference', () => {
    expect(
      voucherTypeProblem('write_off_entry', [l(null), l(null)], { writeOffAccountId: 'wo' }),
    ).toMatch(/الشطب/);
    expect(
      voucherTypeProblem('write_off_entry', [l(null, { accountId: 'wo' }), l(null)], {
        writeOffAccountId: 'wo',
      }),
    ).toBeNull();
    expect(voucherTypeProblem('write_off_entry', [l(null), l(null)], {})).toBeNull();
    expect(
      voucherTypeProblem('inter_company_journal_entry', [l(null), l(null)], { reference: ' ' }),
    ).toMatch(/مرجع/);
  });

  it('5. automatic entries get a type from their source', () => {
    expect(voucherTypeForSource('asset_depreciation')).toBe('depreciation_entry');
    expect(voucherTypeForSource('stock_movement')).toBe('journal_entry');
  });
});
