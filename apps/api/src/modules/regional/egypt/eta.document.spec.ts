import {
  buildEtaDocument,
  etaDocumentUuid,
  etaProblems,
  serializeEta,
  type EtaInvoiceInput,
} from './eta.document';

describe('Egyptian e-invoice (ETA) layer (plan item 48)', () => {
  const input: EtaInvoiceInput = {
    documentType: 'I',
    version: '1.0',
    internalId: 'SINV-1',
    dateTimeIssued: '2026-09-24T10:00:00Z',
    issuer: {
      rin: '123456789',
      name: 'Motion',
      activityCode: '4649',
      address: {
        branchID: '0',
        country: 'EG',
        governate: 'Cairo',
        regionCity: 'Nasr City',
        street: 'Abbas',
        buildingNumber: '10',
      },
    },
    receiver: {
      type: 'B',
      id: '987654321',
      name: 'Hospital',
      address: {
        country: 'EG',
        governate: 'Giza',
        regionCity: 'Dokki',
        street: 'Tahrir',
        buildingNumber: '5',
      },
    },
    lines: [
      {
        description: 'Bed',
        itemType: 'EGS',
        itemCode: 'EG-123456789-1',
        internalCode: 'ITM-1',
        unitType: 'EA',
        quantity: 2,
        unitPrice: 1000,
        taxRate: 14,
        taxSubType: 'V009',
      },
      {
        description: 'Service',
        itemType: 'EGS',
        itemCode: 'EG-123456789-2',
        internalCode: 'SRV',
        unitType: 'EA',
        quantity: 1,
        unitPrice: 500,
        taxRate: 0,
        taxSubType: 'V009',
      },
    ],
  };

  it('1. totals: net, T1 tax and total', () => {
    const d = buildEtaDocument(input);
    expect(d).toMatchObject({
      totalSalesAmount: 2500,
      netAmount: 2500,
      totalAmount: 2780,
      taxTotals: [{ taxType: 'T1', amount: 280 }],
    });
    expect((d.invoiceLines as Array<{ taxableItems: unknown[] }>)[1]!.taxableItems).toEqual([]);
  });

  it('2. canonical serialisation follows the SDK rule (upper-case names, arrays repeat the name)', () => {
    expect(serializeEta({ a: '1', list: [{ x: 2 }, { x: 3 }], o: { b: 'y' } })).toBe(
      '"A""1""LIST""LIST""X""2""LIST""X""3""O""B""y"',
    );
  });

  it('3. document UUID = SHA-256 of the canonical form, signatures not included', () => {
    const d = buildEtaDocument(input);
    const id = etaDocumentUuid(d);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(etaDocumentUuid({ ...d, signatures: [{ signatureType: 'I', value: 'x' }] })).toBe(id);
    expect(etaDocumentUuid({ ...d, internalID: 'SINV-2' })).not.toBe(id);
  });

  it('4. validation: tax ids, national id over 50,000, item codes', () => {
    expect(etaProblems(input)).toEqual([]);
    expect(etaProblems({ ...input, receiver: { ...input.receiver, id: '12' } }).join()).toMatch(
      /9 أرقام/,
    );
    const person = {
      ...input,
      receiver: { type: 'P' as const, id: null, name: 'Ali', address: null },
      lines: [{ ...input.lines[0]!, unitPrice: 30000 }],
    };
    expect(etaProblems(person).join()).toMatch(/رقم قومي/);
    expect(etaProblems({ ...input, lines: [{ ...input.lines[0]!, itemCode: '' }] }).join()).toMatch(
      /ملوش كود/,
    );
  });
});
