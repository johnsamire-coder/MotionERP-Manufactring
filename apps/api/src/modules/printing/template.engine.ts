/**
 * Print template language (plan item 47) — safe, no code execution, values HTML-escaped.
 *   {{field}}  {{a.b}}  {{{field}}} (raw, only for trusted letterhead HTML)
 *   {{#each lines}} … {{quantity}} {{@index}} {{../invoiceNumber}} … {{/each}}
 *   {{#if field}} … {{else}} … {{/if}}
 *   filters: {{invoiceDate | date}}  {{grandTotal | money}}  {{quantity | number}}
 */
type Data = Record<string, unknown>;

export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const FILTERS: Record<string, (v: unknown) => string> = {
  date: (v) => { const d = new Date(String(v)); return v && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : String(v ?? ''); },
  money: (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? String(v ?? '') : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
  number: (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? String(v ?? '') : String(Number(v))),
};

function lookup(expr: string, scopes: Data[]): unknown {
  const [path, ...filters] = expr.split('|').map((x) => x.trim());
  let value = lookupPath(path!, scopes);
  for (const f of filters) {
    const fn = FILTERS[f];
    if (!fn) throw new Error(`template: unknown filter "${f}"`);
    value = fn(value);
  }
  return value;
}

function lookupPath(path: string, scopes: Data[]): unknown {
  let depth = 0;
  let p = path.trim();
  while (p.startsWith('../')) { depth++; p = p.slice(3); }
  const scope = scopes[Math.max(0, scopes.length - 1 - depth)] ?? {};
  if (p === 'this') return scope;
  return p.split('.').reduce<unknown>((cur, key) => (cur !== null && typeof cur === 'object' ? (cur as Data)[key] : undefined), scope);
}

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : Boolean(v) && v !== '0');

/** Finds the matching close tag for a block starting after `from`, honouring nesting. */
function findClose(tpl: string, kind: 'each' | 'if', from: number): { elseAt: number; closeAt: number } {
  const re = new RegExp(`{{(#${kind}\\b[^}]*|else|/${kind})}}`, 'g');
  re.lastIndex = from;
  let depth = 0; let elseAt = -1; let m: RegExpExecArray | null;
  while ((m = re.exec(tpl))) {
    if (m[1]!.startsWith('#')) depth++;
    else if (m[1] === 'else') { if (depth === 0 && kind === 'if' && elseAt === -1) elseAt = m.index; }
    else if (depth === 0) return { elseAt, closeAt: m.index };
    else depth--;
  }
  throw new Error(`template: missing {{/${kind}}}`);
}

function renderWith(tpl: string, scopes: Data[]): string {
  let out = '';
  let i = 0;
  while (i < tpl.length) {
    const open = tpl.indexOf('{{', i);
    if (open === -1) { out += tpl.slice(i); break; }
    out += tpl.slice(i, open);
    if (tpl.startsWith('{{{', open)) {
      const end = tpl.indexOf('}}}', open);
      if (end === -1) throw new Error('template: unclosed {{{');
      out += String(lookup(tpl.slice(open + 3, end), scopes) ?? '');
      i = end + 3;
      continue;
    }
    const end = tpl.indexOf('}}', open);
    if (end === -1) throw new Error('template: unclosed {{');
    const tag = tpl.slice(open + 2, end).trim();
    if (tag.startsWith('#each ') || tag.startsWith('#if ')) {
      const kind = tag.startsWith('#each') ? 'each' : 'if';
      const expr = tag.slice(kind === 'each' ? 6 : 4).trim();
      const { elseAt, closeAt } = findClose(tpl, kind, end + 2);
      const body = tpl.slice(end + 2, elseAt === -1 ? closeAt : elseAt);
      const alt = elseAt === -1 ? '' : tpl.slice(tpl.indexOf('}}', elseAt) + 2, closeAt);
      const value = lookup(expr, scopes);
      if (kind === 'each') {
        const list = Array.isArray(value) ? value : [];
        out += list.map((item, index) => renderWith(body, [...scopes, { ...(typeof item === 'object' && item !== null ? item as Data : { this: item }), '@index': index + 1 }])).join('');
      } else {
        out += renderWith(truthy(value) ? body : alt, scopes);
      }
      i = tpl.indexOf('}}', closeAt) + 2;
      continue;
    }
    if (tag.startsWith('/') || tag === 'else') throw new Error(`template: unexpected {{${tag}}}`);
    out += escapeHtml(lookup(tag, scopes));
    i = end + 2;
  }
  return out;
}

export function renderTemplate(tpl: string, data: Data): string {
  return renderWith(tpl, [data]);
}

/** Validates a template by rendering it against empty data (throws on broken syntax). */
export function checkTemplate(tpl: string): void {
  renderTemplate(tpl, {});
}
