import { findLedgerIssues, type BookedDocument, type GlEntry } from './ledger-health.service';

describe('Ledger health — document books vs general ledger (plan item 37)', () => {
  const doc = (id: string, type = 'sales_invoice', orgNodeId = 'co'): BookedDocument =>
    ({ type, id, number: `N-${id}`, orgNodeId, idempotencyKey: `${type.replace('_', '-')}-${id}` });
  const je = (id: string, key: string | null, source: string | null, debit = 100, credit = 100): GlEntry =>
    ({ id, entryNumber: `JE-${id}`, orgNodeId: 'co', idempotencyKey: key, sourceEventType: source, debit, credit });
  const companies = new Set(['co']);

  it('1. a clean book has no issues', () => {
    expect(findLedgerIssues([doc('1')], [je('a', 'sales-invoice-1', 'sales_invoice')], companies)).toEqual([]);
  });

  it('2. a posted document without its entry is reported (only for companies keeping books)', () => {
    const issues = findLedgerIssues([doc('1'), doc('2', 'sales_invoice', 'no-books')], [], companies);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ checkType: 'missing_gl_entry', documentId: '1', documentNumber: 'N-1' });
  });

  it('3. an entry whose document is gone / not posted is an orphan; manual entries are not', () => {
    const issues = findLedgerIssues([], [je('a', 'sales-invoice-9', 'sales_invoice'), je('m', null, null)], companies);
    expect(issues.map((i) => [i.checkType, i.journalEntryId])).toEqual([['orphan_gl_entry', 'a']]);
  });

  it('4. an unbalanced posted entry is reported', () => {
    const issues = findLedgerIssues([], [je('x', null, null, 100, 90)], companies);
    expect(issues[0]).toMatchObject({ checkType: 'debit_credit_mismatch', issueKey: 'dc:x' });
    expect(issues[0]!.details).toMatch(/مش متوازن/);
  });
});
