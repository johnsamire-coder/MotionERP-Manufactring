import { evaluateCondition, validateCondition } from './workflow.condition';
import { validateDefinition, type DefinitionInput } from './workflow.service';

describe('Workflow engine (plan item 42)', () => {
  const data = { amount: '15000', type: 'capex', customer: { segment: 'gov' }, tags: ['urgent'] };

  it('1. conditions: comparisons, nesting, dotted paths, numbers as strings', () => {
    expect(evaluateCondition({ field: 'amount', op: 'gt', value: 10000 }, data)).toBe(true);
    expect(
      evaluateCondition({ field: 'customer.segment', op: 'in', value: ['gov', 'ngo'] }, data),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          all: [
            { field: 'type', op: 'eq', value: 'capex' },
            { not: { field: 'amount', op: 'lte', value: 20000 } },
          ],
        },
        data,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        {
          any: [
            { field: 'missing', op: 'exists' },
            { field: 'tags', op: 'contains', value: 'urgent' },
          ],
        },
        data,
      ),
    ).toBe(true);
    expect(evaluateCondition(null, data)).toBe(true);
    expect(evaluateCondition({ field: 'type', op: 'gt', value: 3 }, data)).toBe(false);
  });

  it('2. malformed conditions are refused when saved', () => {
    expect(() => validateCondition({ field: 'a', op: 'like', value: 1 })).toThrow(/op/);
    expect(() => validateCondition({ all: [] })).toThrow(/non-empty/);
    expect(() => validateCondition({ field: 'a', op: 'in', value: 3 })).toThrow(/list/);
  });

  const def = (over: Partial<DefinitionInput> = {}): DefinitionInput => ({
    code: 'PR',
    name: 'Purchase request',
    documentType: 'purchase_request',
    initialState: 'draft',
    states: [
      { code: 'draft', name: 'مسودة' },
      { code: 'pending', name: 'مستني' },
      { code: 'approved', name: 'معتمد', isFinal: true },
      { code: 'rejected', name: 'مرفوض', isFinal: true },
    ],
    transitions: [
      { fromState: 'draft', toState: 'pending', action: 'submit' },
      { fromState: 'pending', toState: 'approved', action: 'approve', allowedRoles: ['manager'] },
      { fromState: 'pending', toState: 'rejected', action: 'reject', allowedRoles: ['manager'] },
    ],
    ...over,
  });

  it('3. a sound definition passes; broken graphs are refused', () => {
    expect(() => validateDefinition(def())).not.toThrow();
    expect(() => validateDefinition(def({ initialState: 'x' }))).toThrow(/initial state/);
    expect(() => validateDefinition(def({ transitions: def().transitions.slice(0, 1) }))).toThrow(
      /dead end/,
    );
    expect(() =>
      validateDefinition(
        def({
          transitions: [
            ...def().transitions,
            { fromState: 'approved', toState: 'draft', action: 'reopen' },
          ],
        }),
      ),
    ).toThrow(/final state/);
    expect(() =>
      validateDefinition(
        def({
          transitions: [
            ...def().transitions,
            { fromState: 'draft', toState: 'rejected', action: 'submit' },
          ],
        }),
      ),
    ).toThrow(/twice/);
  });
});
