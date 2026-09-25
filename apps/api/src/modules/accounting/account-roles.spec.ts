import { ACCOUNT_ROLES, isAccountRole, manualLineProblem } from './account-roles';

describe('Standard account roles (plan item 32)', () => {
  it('1. the full ERPNext list, each with a label and a consistent normal balance', () => {
    expect(Object.keys(ACCOUNT_ROLES)).toHaveLength(30);
    expect(ACCOUNT_ROLES.receivable).toMatchObject({
      normalBalance: 'debit',
      requiresParty: 'customer',
    });
    expect(ACCOUNT_ROLES.payable).toMatchObject({
      normalBalance: 'credit',
      requiresParty: 'supplier',
    });
    expect(isAccountRole('stock')).toBe(true);
    expect(isAccountRole('toString')).toBe(false);
  });

  it('2. receivable / payable lines must name the right party', () => {
    const ar = { code: '1201', role: 'receivable' as const };
    expect(manualLineProblem(ar, {})).toMatch(/العميل/);
    expect(manualLineProblem(ar, { partyType: 'supplier', partyId: 's' })).toMatch(/العميل/);
    expect(manualLineProblem(ar, { partyType: 'customer', partyId: 'c' })).toBeNull();
    expect(
      manualLineProblem({ code: '2101', role: 'payable' }, { partyType: 'supplier', partyId: 's' }),
    ).toBeNull();
  });

  it('3. stock accounts refuse manual lines; plain accounts allow anything', () => {
    expect(manualLineProblem({ code: '1301', role: 'stock' }, {})).toMatch(/حركات المخزون/);
    expect(manualLineProblem({ code: '5101', role: null }, {})).toBeNull();
    expect(manualLineProblem({ code: '1101', role: 'cash' }, {})).toBeNull();
  });
});
