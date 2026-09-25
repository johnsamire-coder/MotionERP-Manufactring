import { ProductionService } from './production.service';
import type { ProductionRepository } from './production.repository';
import type { InventoryService } from '../inventory/inventory.service';
import type { SalesService } from '../sales/sales.service';
import type { CostService } from '../cost/cost.service';
import type { MaterialRequestRecord } from './production.types';

function req(over: Partial<MaterialRequestRecord>): MaterialRequestRecord {
  return {
    id: 'r1',
    jobOrderReference: 'JO-1',
    orgNodeId: null,
    itemId: 'item-1',
    warehouseId: 'wh-1',
    plannedQuantity: '10.000000',
    requestedQuantity: '10.000000',
    issuedQuantity: null,
    actualUsedQuantity: null,
    issueMovementId: null,
    issuedValue: null,
    status: 'approved',
    deviationReason: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

describe('ProductionService — material issue to WIP and planned-vs-actual variance', () => {
  const rows = new Map<string, MaterialRequestRecord>();
  const createMovement = jest.fn(async () => ({ id: 'mv-9', totalValue: '240.0000' }));
  const repository = {
    findRequestById: jest.fn(async (id: string) => rows.get(id) ?? null),
    listRequests: jest.fn(async () => [...rows.values()]),
    recordIssue: jest.fn(
      async (id: string, qty: string, issue?: { movementId: string; value: string | null }) => {
        const r = {
          ...rows.get(id)!,
          issuedQuantity: qty,
          status: 'issued' as const,
          issueMovementId: issue?.movementId ?? null,
          issuedValue: issue?.value ?? null,
        };
        rows.set(id, r);
        return r;
      },
    ),
  } as unknown as ProductionRepository;
  const recordActualMaterialCost = jest.fn(async () => ({}));
  const service = new ProductionService(
    repository,
    { createMovement } as unknown as InventoryService,
    {} as SalesService,
    { recordActualMaterialCost } as unknown as CostService,
  );

  beforeEach(() => {
    rows.clear();
    createMovement.mockClear();
    recordActualMaterialCost.mockReset();
    recordActualMaterialCost.mockImplementation(async () => ({}));
  });

  it('records the issue as actual material cost on the job order, keyed by the request', async () => {
    rows.set('r1', req({ requestedQuantity: '12.000000' }));
    await service.issueRequest('r1');
    expect(recordActualMaterialCost).toHaveBeenCalledWith(
      'JO-1',
      '240.0000',
      'material-request:r1',
      expect.any(String),
    );
  });

  it('keeps the issue when recording its cost fails (stock already moved and posted)', async () => {
    rows.set('r1', req({}));
    recordActualMaterialCost.mockRejectedValueOnce(new Error('no cost sheet'));
    const issued = await service.issueRequest('r1');
    expect(issued.status).toBe('issued');
  });

  it('issues to production (WIP) and records the movement and its actual value', async () => {
    rows.set('r1', req({ requestedQuantity: '12.000000' }));
    const issued = await service.issueRequest('r1');
    expect(createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType: 'issue',
        purpose: 'manufacture_consumption',
        sourceModule: 'production',
        sourceId: 'r1',
        quantity: '12.000000',
      }),
    );
    expect(issued.issueMovementId).toBe('mv-9');
    expect(issued.issuedValue).toBe('240.0000');
  });

  it('values usage variance, over-request and not-returned at the actual issue rate', async () => {
    // planned 10, requested/issued 12 at 20/unit (240), actually used 11
    rows.set(
      'r1',
      req({
        requestedQuantity: '12.000000',
        issuedQuantity: '12.000000',
        actualUsedQuantity: '11.000000',
        issuedValue: '240.0000',
        status: 'closed',
      }),
    );
    // not issued yet: counted as pending, no value
    rows.set('r2', req({ id: 'r2', itemId: 'item-2' }));
    // rejected: excluded
    rows.set('r3', req({ id: 'r3', status: 'rejected' }));

    const rep = await service.getMaterialVariance('JO-1');

    expect(rep.lines).toHaveLength(2);
    const l = rep.lines.find((x) => x.requestId === 'r1')!;
    expect(l.actualRate).toBe('20.0000');
    expect(l.overRequestQuantity).toBe('2.0000');
    expect(l.usageVarianceQuantity).toBe('1.0000');
    expect(l.usageVarianceValue).toBe('20.0000');
    expect(l.notReturnedQuantity).toBe('1.0000');
    expect(rep.totals).toEqual({
      plannedValue: '200.0000',
      issuedValue: '240.0000',
      usedValue: '220.0000',
      usageVarianceValue: '20.0000',
      notReturnedValue: '20.0000',
    });
    expect(rep.pendingLines).toBe(1);
  });
});
