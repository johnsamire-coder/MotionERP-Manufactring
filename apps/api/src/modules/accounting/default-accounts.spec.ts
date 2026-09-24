import { checkDefaultAccount, DEFAULT_ACCOUNTS } from './default-accounts';

describe('Company default accounts (plan item 33)', () => {
  const ar = DEFAULT_ACCOUNTS.find((s) => s.key === 'defaultReceivableAccountId')!;
  const acc = { code: '1201', orgNodeId: 'co', isLeaf: true, status: 'active' };

  it('1. exactly 19 distinct defaults', () => {
    expect(DEFAULT_ACCOUNTS).toHaveLength(19);
    expect(new Set(DEFAULT_ACCOUNTS.map((s) => s.key)).size).toBe(19);
  });

  it('2. missing, wrong company, parent, inactive, wrong role are all reported', () => {
    expect(checkDefaultAccount(ar, 'co', null, null, null)).toBe('مش متحدد');
    expect(checkDefaultAccount(ar, 'co', null, null, 'x')).toMatch(/مش موجود/);
    expect(checkDefaultAccount(ar, 'co', { ...acc, orgNodeId: 'other' }, null, 'x')).toMatch(
      /شركة تانية/,
    );
    expect(checkDefaultAccount(ar, 'co', { ...acc, isLeaf: false }, null, 'x')).toMatch(/حساب أب/);
    expect(checkDefaultAccount(ar, 'co', { ...acc, status: 'inactive' }, null, 'x')).toMatch(
      /موقوف/,
    );
    expect(checkDefaultAccount(ar, 'co', acc, 'payable', 'x')).toMatch(/المتوقع receivable/);
  });

  it('3. the right role, or no role at all, is accepted', () => {
    expect(checkDefaultAccount(ar, 'co', acc, 'receivable', 'x')).toBeNull();
    expect(checkDefaultAccount(ar, 'co', acc, null, 'x')).toBeNull();
  });
});
