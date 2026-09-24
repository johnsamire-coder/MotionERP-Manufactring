/**
 * A small, safe condition language for workflow transitions (plan item 42) — plain JSON, never eval.
 *   { "field": "amount", "op": "gt", "value": 10000 }
 *   { "all": [ ... ] } | { "any": [ ... ] } | { "not": { ... } }
 * Fields are dotted paths into the document data ("customer.segment").
 */
export type ConditionOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'contains';
export type Condition =
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { field: string; op: ConditionOp; value?: unknown };

const OPS: readonly ConditionOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists', 'contains'];

function read(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => (cur !== null && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined), data);
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Throws on a malformed condition (used when a definition is saved). */
export function validateCondition(c: unknown, depth = 0): asserts c is Condition {
  if (depth > 10) throw new Error('condition is nested too deeply');
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('a condition must be an object');
  const o = c as Record<string, unknown>;
  if ('all' in o || 'any' in o) {
    const list = (o.all ?? o.any) as unknown;
    if (!Array.isArray(list) || list.length === 0) throw new Error('"all" / "any" need a non-empty list');
    list.forEach((x) => validateCondition(x, depth + 1));
    return;
  }
  if ('not' in o) { validateCondition(o.not, depth + 1); return; }
  if (typeof o.field !== 'string' || !o.field) throw new Error('a comparison needs "field"');
  if (!OPS.includes(o.op as ConditionOp)) throw new Error(`"op" must be one of: ${OPS.join(', ')}`);
  if ((o.op === 'in' || o.op === 'nin') && !Array.isArray(o.value)) throw new Error(`"${String(o.op)}" needs a list value`);
}

export function evaluateCondition(c: Condition | null | undefined, data: Record<string, unknown>): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => evaluateCondition(x, data));
  if ('any' in c) return c.any.some((x) => evaluateCondition(x, data));
  if ('not' in c) return !evaluateCondition(c.not, data);
  const actual = read(data, c.field);
  switch (c.op) {
    case 'exists': return actual !== undefined && actual !== null && actual !== '';
    case 'eq': return actual === c.value || (num(actual) !== null && num(actual) === num(c.value));
    case 'ne': return !(actual === c.value || (num(actual) !== null && num(actual) === num(c.value)));
    case 'in': return (c.value as unknown[]).includes(actual);
    case 'nin': return !(c.value as unknown[]).includes(actual);
    case 'contains': return Array.isArray(actual) ? actual.includes(c.value) : typeof actual === 'string' && actual.includes(String(c.value));
    default: {
      const a = num(actual); const b = num(c.value);
      if (a === null || b === null) return false;
      return c.op === 'gt' ? a > b : c.op === 'gte' ? a >= b : c.op === 'lt' ? a < b : a <= b;
    }
  }
}
