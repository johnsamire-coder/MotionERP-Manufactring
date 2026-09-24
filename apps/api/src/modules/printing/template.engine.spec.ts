import { checkTemplate, renderTemplate } from './template.engine';

describe('Print template engine (plan item 47)', () => {
  const data = { invoiceNumber: 'SI-1', customer: { name: 'مستشفى <النيل>' }, lines: [{ item: 'سرير', qty: 2 }, { item: 'شاشة', qty: 1 }], notes: '' };

  it('1. fields, dotted paths and HTML escaping', () => {
    expect(renderTemplate('{{invoiceNumber}} / {{customer.name}}', data)).toBe('SI-1 / مستشفى &lt;النيل&gt;');
  });

  it('2. loops with index and parent access', () => {
    expect(renderTemplate('{{#each lines}}<tr>{{@index}}-{{item}}x{{qty}} ({{../invoiceNumber}})</tr>{{/each}}', data))
      .toBe('<tr>1-سريرx2 (SI-1)</tr><tr>2-شاشةx1 (SI-1)</tr>');
  });

  it('3. if / else, nested blocks', () => {
    expect(renderTemplate('{{#if notes}}N:{{notes}}{{else}}no notes{{/if}}', data)).toBe('no notes');
    expect(renderTemplate('{{#each lines}}{{#if qty}}[{{item}}]{{/if}}{{/each}}', data)).toBe('[سرير][شاشة]');
  });

  it('5. filters format dates and money; unknown filters are refused', () => {
    expect(renderTemplate('{{d | date}} {{m | money}} {{q | number}}', { d: '2026-09-24T00:00:00.000Z', m: '1234.5', q: '2.000000' })).toBe('2026-09-24 1,234.50 2');
    expect(() => renderTemplate('{{x | upper}}', {})).toThrow(/unknown filter/);
  });

  it('4. triple braces keep trusted HTML; broken templates are refused', () => {
    expect(renderTemplate('{{{html}}}', { html: '<b>x</b>' })).toBe('<b>x</b>');
    expect(() => checkTemplate('{{#each lines}}x')).toThrow(/missing/);
    expect(() => checkTemplate('{{/if}}')).toThrow(/unexpected/);
  });
});
