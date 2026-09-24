import type { DatabaseService } from '../../core/database/database.service';
import type { CrmRepository } from './crm.repository';
import type { CustomerRecord } from './crm.types';
import { buildGroupTree, PartyGroupService, type PartyGroupRecord } from './party-group.service';

const g = (id: string, parentGroupId: string | null, isGroup: boolean, defaultCreditLimit: string | null = null): PartyGroupRecord =>
  ({ id, groupType: 'customer', code: id.toUpperCase(), name: id, parentGroupId, isGroup, defaultCreditLimit, createdAt: '', updatedAt: '' });

describe('Customer / supplier group trees (plan item 28)', () => {
  // all (group, limit 50000) → retail (group) → cairo-retail (leaf) ; wholesale (leaf, limit 200000)
  const groups = [g('all', null, true, '50000.0000'), g('retail', 'all', true), g('cairo', 'retail', false), g('wholesale', 'all', false, '200000.0000')];

  it('1. counts direct and subtree members', () => {
    const [root] = buildGroupTree(groups, ['cairo', 'cairo', 'wholesale', null]);
    expect(root).toMatchObject({ memberCount: 0, totalMembers: 3 });
    expect(root!.children.find((c) => c.id === 'retail')).toMatchObject({ totalMembers: 2 });
  });

  describe('service rules', () => {
    let service: PartyGroupService;
    let setGroup: jest.Mock;
    beforeEach(() => {
      service = new PartyGroupService({} as DatabaseService, {} as CrmRepository);
      jest.spyOn(service, 'list').mockResolvedValue(groups);
      jest.spyOn(service, 'get').mockImplementation(async (id: string) => groups.find((x) => x.id === id)!);
      setGroup = jest.fn(async (id: string, groupId: string | null) => ({ id, customerGroupId: groupId }));
      (service as unknown as { crm: Partial<CrmRepository> }).crm = {
        findCustomerById: jest.fn(async () => ({ id: 'c' } as CustomerRecord)), setCustomerGroup: setGroup,
      };
    });

    it('2. customers attach to leaf groups only', async () => {
      await expect(service.assignCustomer('c', 'retail')).rejects.toThrow(/مجموعة أب/);
      await service.assignCustomer('c', 'cairo');
      expect(setGroup).toHaveBeenCalledWith('c', 'cairo');
    });

    it('3. moving a group under its own descendant is refused', async () => {
      await expect(service.update('all', { parentGroupId: 'retail' })).rejects.toThrow(/حلقة/);
      await expect(service.update('retail', { parentGroupId: 'wholesale' })).rejects.toThrow(/مش مجموعة أب/);
    });

    it('4. credit limit: own first, else the nearest group up the tree', async () => {
      const c = (creditLimit: string | null, customerGroupId: string | null): CustomerRecord => ({ creditLimit, customerGroupId } as CustomerRecord);
      expect(await service.effectiveCreditLimit(c('1000', 'cairo'))).toEqual({ limit: '1000', source: 'customer' });
      expect(await service.effectiveCreditLimit(c(null, 'cairo'))).toEqual({ limit: '50000.0000', source: 'group', groupCode: 'ALL' });
      expect(await service.effectiveCreditLimit(c(null, 'wholesale'))).toMatchObject({ limit: '200000.0000', groupCode: 'WHOLESALE' });
      expect(await service.effectiveCreditLimit(c(null, null))).toEqual({ limit: null, source: null });
    });
  });
});
