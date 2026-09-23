import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import type { StockReservationRecord } from './inventory.types';

describe('Seven reservation / request types and the Bin view (plan item 13)', () => {
  let reserved: number;
  let reservations: StockReservationRecord[];
  let service: InventoryService;

  beforeEach(() => {
    reserved = 0;
    reservations = [];
    const repo = {
      findWarehouseById: jest.fn().mockResolvedValue({ id: 'wh', orgNodeId: 'o' }),
      findBalance: jest.fn().mockImplementation(async () => ({ onHand: '100', reserved: String(reserved) })),
      listBalances: jest.fn().mockImplementation(async () => [{ itemId: 'i', warehouseId: 'wh', onHand: '100', reserved: String(reserved) }]),
      insertReservation: jest.fn().mockImplementation(async (r) => {
        const rec = { ...r, status: 'active', createdAt: '', releasedAt: null } as StockReservationRecord;
        reservations.push(rec);
        return rec;
      }),
      applyReservedDelta: jest.fn().mockImplementation(async (_i: string, _w: string, d: string) => { reserved += Number(d); }),
      listReservations: jest.fn().mockImplementation(async () => reservations),
      findReservationById: jest.fn().mockImplementation(async (id: string) => reservations.find((r) => r.id === id) ?? null),
      setReservationReleased: jest.fn().mockImplementation(async (id: string) => {
        const r = reservations.find((x) => x.id === id)!;
        r.status = 'released';
        return r;
      }),
    } as unknown as InventoryRepository;
    service = new InventoryService(repo);
  });

  const reserve = (reservationType: StockReservationRecord['reservationType'], quantity: string): Promise<StockReservationRecord> =>
    service.reserveStock({ itemId: 'i', warehouseId: 'wh', quantity, source: 'doc', reservationType });

  it('1. reserving types lock stock; expected types (ordered/indented/planned) do not', async () => {
    await reserve('sales_order', '10');
    await reserve('production', '20');
    await reserve('subcontract', '5');
    await reserve('production_plan', '15');
    await reserve('purchase_order', '40');
    await reserve('material_request', '7');
    await reserve('work_order', '3');
    expect(reserved).toBe(50);
    const [bin] = await service.getBins('i', 'wh');
    expect(bin).toMatchObject({
      actualQty: '100.000000', reservedQty: '10.000000', reservedForProduction: '20.000000',
      reservedForSubcontract: '5.000000', reservedForProductionPlan: '15.000000',
      orderedQty: '40.000000', indentedQty: '7.000000', plannedQty: '3.000000',
      availableQty: '50.000000', projectedQty: '100.000000', // 100 + 50 expected − 50 reserved
    });
  });

  it('2. only reserving types need available stock; releasing an expected type leaves reserved alone', async () => {
    await expect(reserve('sales_order', '101')).rejects.toThrow(/insufficient available stock/);
    const po = await reserve('purchase_order', '500');
    await service.releaseReservation(po.id);
    expect(reserved).toBe(0);
    await expect(reserve('bogus' as never, '1')).rejects.toThrow(/reservationType must be one of/);
  });
});
