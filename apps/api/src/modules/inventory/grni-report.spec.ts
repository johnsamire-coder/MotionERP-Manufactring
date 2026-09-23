import type { OrganizationService } from '../organization/organization.service';
import type { GrniReportRepository, ReceivedNotBilledRow } from './grni-report.repository';
import { GrniReportService } from './grni-report.service';

describe('Received-not-billed / GRNI report (plan item 14)', () => {
  const row = (id: string, received: number, billed: number): ReceivedNotBilledRow => ({
    movementId: id, movementDate: '', itemId: 'i', warehouseId: 'wh', purchaseOrderId: null, quantity: '1',
    receivedValue: received.toFixed(4), billedValue: billed.toFixed(4), outstandingValue: Math.max(0, received - billed).toFixed(4),
  });

  it('lists outstanding receipts, totals them and reconciles with the GRNI ledger', async () => {
    const repo = {
      receipts: jest.fn().mockResolvedValue([row('a', 1000, 1000), row('b', 500, 200), row('c', 70, 0)]),
      ledgerGrniBalance: jest.fn().mockResolvedValue({ accountId: 'grni', balance: 400 }),
    } as unknown as GrniReportRepository;
    const org = { getSubtree: jest.fn().mockResolvedValue({ id: 'co', children: [{ id: 'br', children: [] }] }) } as unknown as OrganizationService;
    const service = new GrniReportService(repo, org);

    const report = await service.receivedNotBilled('co');
    expect(repo.receipts).toHaveBeenCalledWith(['co', 'br']);
    expect(report.rows.map((r) => r.movementId)).toEqual(['b', 'c']);
    expect(report.totalOutstanding).toBe('370.0000');
    expect(report.ledger).toEqual({ accountId: 'grni', balance: '400.0000', difference: '30.0000' });

    const all = await service.receivedNotBilled(undefined, true);
    expect(all.rows).toHaveLength(3);
    expect(all.ledger).toBeNull();
  });
});
