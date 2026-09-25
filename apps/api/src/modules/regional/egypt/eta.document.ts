import { createHash } from 'node:crypto';

/**
 * Egyptian e-invoice (ETA) document builder and canonical serialiser (plan item 48), pure.
 * Follows the public ETA e-invoicing SDK: document structure v0.9 / v1.0 and the documented
 * serialisation used for hashing and signing.
 */
export interface EtaAddress {
  branchID?: string;
  country: string;
  governate: string;
  regionCity: string;
  street: string;
  buildingNumber: string;
}
export interface EtaIssuer {
  rin: string;
  name: string;
  activityCode: string;
  address: EtaAddress & { branchID: string };
}
export interface EtaReceiver {
  type: 'B' | 'P' | 'F';
  id: string | null;
  name: string;
  address: EtaAddress | null;
}
export interface EtaLineInput {
  description: string;
  itemType: 'EGS' | 'GS1';
  itemCode: string;
  internalCode: string;
  unitType: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxSubType: string;
}
export interface EtaInvoiceInput {
  documentType: 'I' | 'C' | 'D';
  version: '0.9' | '1.0';
  internalId: string;
  dateTimeIssued: string;
  issuer: EtaIssuer;
  receiver: EtaReceiver;
  lines: EtaLineInput[];
}

const r5 = (n: number): number => Math.round(n * 1e5) / 1e5;

/** Problems that would make ETA reject the document (checked before anything is sent). */
export function etaProblems(i: EtaInvoiceInput): string[] {
  const p: string[] = [];
  if (!/^\d{9}$/.test(i.issuer.rin)) p.push('رقم التسجيل الضريبي للشركة (RIN) لازم يبقى 9 أرقام');
  if (!/^\d{4}$/.test(i.issuer.activityCode)) p.push('كود النشاط لازم يبقى 4 أرقام');
  if (i.lines.length === 0) p.push('الفاتورة مفيهاش سطور');
  const total = i.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 + l.taxRate / 100), 0);
  if (i.receiver.type === 'B' && !/^\d{9}$/.test(i.receiver.id ?? ''))
    p.push('العميل شركة (B) — لازم رقم تسجيل ضريبي 9 أرقام');
  if (i.receiver.type === 'P' && total >= 50000 && !/^\d{14}$/.test(i.receiver.id ?? ''))
    p.push('العميل فرد والفاتورة ≥ 50,000 — لازم رقم قومي 14 رقم');
  if (i.receiver.type !== 'P' && !i.receiver.address) p.push('عنوان العميل مطلوب');
  for (const l of i.lines) {
    if (!l.itemCode) p.push(`الصنف "${l.description}" ملوش كود ${l.itemType}`);
    if (!(l.quantity > 0)) p.push(`كمية "${l.description}" لازم تبقى موجبة`);
  }
  return p;
}

/** Builds the ETA JSON (amounts rounded to 5 decimals as the SDK does). */
export function buildEtaDocument(i: EtaInvoiceInput): Record<string, unknown> {
  const lines = i.lines.map((l) => {
    const salesTotal = r5(l.quantity * l.unitPrice);
    const tax = r5((salesTotal * l.taxRate) / 100);
    return {
      description: l.description,
      itemType: l.itemType,
      itemCode: l.itemCode,
      unitType: l.unitType,
      quantity: r5(l.quantity),
      internalCode: l.internalCode,
      salesTotal,
      total: r5(salesTotal + tax),
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal: salesTotal,
      itemsDiscount: 0,
      unitValue: { currencySold: 'EGP', amountEGP: r5(l.unitPrice) },
      discount: { rate: 0, amount: 0 },
      taxableItems:
        l.taxRate > 0
          ? [{ taxType: 'T1', amount: tax, subType: l.taxSubType, rate: l.taxRate }]
          : [],
    };
  });
  const net = r5(lines.reduce((s, l) => s + l.netTotal, 0));
  const taxT1 = r5(lines.reduce((s, l) => s + (l.taxableItems[0]?.amount ?? 0), 0));
  const receiver: Record<string, unknown> = { type: i.receiver.type, name: i.receiver.name };
  if (i.receiver.id) receiver.id = i.receiver.id;
  if (i.receiver.address) receiver.address = i.receiver.address;
  return {
    issuer: { address: i.issuer.address, type: 'B', id: i.issuer.rin, name: i.issuer.name },
    receiver,
    documentType: i.documentType,
    documentTypeVersion: i.version,
    dateTimeIssued: i.dateTimeIssued,
    taxpayerActivityCode: i.issuer.activityCode,
    internalID: i.internalId,
    invoiceLines: lines,
    totalDiscountAmount: 0,
    totalSalesAmount: net,
    netAmount: net,
    taxTotals: taxT1 > 0 ? [{ taxType: 'T1', amount: taxT1 }] : [],
    totalAmount: r5(net + taxT1),
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
  };
}

/**
 * ETA canonical serialisation: every property name in upper case and quoted, simple values quoted,
 * arrays write the property name once and then again before every element.
 */
export function serializeEta(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return `"${value === null || value === undefined ? '' : String(value)}"`;
  let out = '';
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const name = `"${key.toUpperCase()}"`;
    if (Array.isArray(v)) {
      out += name;
      for (const el of v) out += name + serializeEta(el);
    } else {
      out += name + serializeEta(v);
    }
  }
  return out;
}

/** The document UUID ETA expects: SHA-256 (hex) of the canonical form, signatures excluded. */
export function etaDocumentUuid(doc: Record<string, unknown>): string {
  const { signatures: _signatures, ...unsigned } = doc as Record<string, unknown> & {
    signatures?: unknown;
  };
  void _signatures;
  return createHash('sha256').update(serializeEta(unsigned), 'utf8').digest('hex');
}
