import { randomUUID } from 'node:crypto';
import {
  OrgCycleError,
  OrgLifecycleError,
  OrgNodeNotFoundError,
  OrgNodeValidationError,
  OrgParentingError,
} from './organization.errors';
import type { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';
import type { OrgNodeRecord, OrgNodeStatus } from './organization.types';

/**
 * In-memory fake of OrganizationRepository. Encodes the same base rules the
 * migration seeds, so the service's business logic can be tested without a DB.
 */
class FakeRepository {
  private nodes = new Map<string, OrgNodeRecord>();

  private static readonly rootTypes = new Set(['group', 'legal_company']);
  private static readonly parentRules = new Set([
    'legal_company>group',
    'activity>group',
    'activity>legal_company',
    'branch>legal_company',
    'branch>activity',
    'department>branch',
    'department>department',
    'warehouse>branch',
    'section>department',
  ]);

  seed(record: Partial<OrgNodeRecord> & Pick<OrgNodeRecord, 'nodeType'>): OrgNodeRecord {
    const now = '2026-01-01T00:00:00.000Z';
    const node: OrgNodeRecord = {
      id: randomUUID(),
      name: record.name ?? record.nodeType,
      parentId: null,
      status: 'active',
      position: 0,
      createdAt: now,
      updatedAt: now,
      ...record,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  findAllNodes(): Promise<OrgNodeRecord[]> {
    return Promise.resolve([...this.nodes.values()]);
  }

  findNodeById(id: string): Promise<OrgNodeRecord | null> {
    return Promise.resolve(this.nodes.get(id) ?? null);
  }

  findNodeType(code: string): Promise<{ code: string; canBeRoot: boolean } | null> {
    const known = [
      'group',
      'legal_company',
      'activity',
      'branch',
      'region',
      'site',
      'factory',
      'department',
      'section',
      'operating_unit',
      'warehouse',
      'work_center',
      'project',
    ];
    if (!known.includes(code)) return Promise.resolve(null);
    return Promise.resolve({ code, canBeRoot: FakeRepository.rootTypes.has(code) });
  }

  isParentingAllowed(childType: string, parentType: string): Promise<boolean> {
    return Promise.resolve(FakeRepository.parentRules.has(`${childType}>${parentType}`));
  }

  listNodeTypes(): Promise<Array<{ code: string; label: string; canBeRoot: boolean }>> {
    return Promise.resolve([
      { code: 'group', label: 'Group', canBeRoot: true },
      { code: 'legal_company', label: 'Legal company', canBeRoot: true },
      { code: 'branch', label: 'Branch', canBeRoot: false },
    ]);
  }

  listParentRules(): Promise<Array<{ childType: string; parentType: string }>> {
    return Promise.resolve([
      { childType: 'legal_company', parentType: 'group' },
      { childType: 'branch', parentType: 'legal_company' },
    ]);
  }

  listAncestorIds(nodeId: string): Promise<string[]> {
    const ids: string[] = [];
    let current = this.nodes.get(nodeId)?.parentId ?? null;
    while (current) {
      ids.push(current);
      current = this.nodes.get(current)?.parentId ?? null;
    }
    return Promise.resolve(ids);
  }

  countActiveChildren(nodeId: string): Promise<number> {
    let count = 0;
    for (const node of this.nodes.values()) {
      if (node.parentId === nodeId && node.status !== 'archived') count += 1;
    }
    return Promise.resolve(count);
  }

  insertNode(input: {
    id: string;
    nodeType: string;
    name: string;
    parentId: string | null;
    position: number;
  }): Promise<OrgNodeRecord> {
    return Promise.resolve(this.seed({ ...input }));
  }

  updateNodeFields(
    id: string,
    fields: { name?: string; position?: number; parentId?: string | null },
  ): Promise<OrgNodeRecord> {
    const node = this.nodes.get(id)!;
    const updated = { ...node, ...fields, updatedAt: '2026-02-02T00:00:00.000Z' };
    this.nodes.set(id, updated);
    return Promise.resolve(updated);
  }

  setNodeStatus(id: string, status: OrgNodeStatus): Promise<OrgNodeRecord> {
    const node = this.nodes.get(id)!;
    const updated = { ...node, status };
    this.nodes.set(id, updated);
    return Promise.resolve(updated);
  }
}

function makeService(): { service: OrganizationService; repo: FakeRepository } {
  const repo = new FakeRepository();
  const service = new OrganizationService(repo as unknown as OrganizationRepository);
  return { service, repo };
}

describe('OrganizationService.createNode', () => {
  it('creates a root node of a root-eligible type', async () => {
    const { service } = makeService();
    const node = await service.createNode({ nodeType: 'group', name: 'HQ', parentId: null });
    expect(node.nodeType).toBe('group');
    expect(node.parentId).toBeNull();
    expect(node.status).toBe('active');
  });

  it('trims the name and rejects a blank one', async () => {
    const { service } = makeService();
    const node = await service.createNode({ nodeType: 'group', name: '  HQ  ', parentId: null });
    expect(node.name).toBe('HQ');

    await expect(
      service.createNode({ nodeType: 'group', name: '   ', parentId: null }),
    ).rejects.toBeInstanceOf(OrgNodeValidationError);
  });

  it('rejects an unknown node type', async () => {
    const { service } = makeService();
    await expect(
      service.createNode({ nodeType: 'spaceship', name: 'X', parentId: null }),
    ).rejects.toBeInstanceOf(OrgNodeValidationError);
  });

  it('rejects a root for a non-root type', async () => {
    const { service } = makeService();
    await expect(
      service.createNode({ nodeType: 'branch', name: 'B', parentId: null }),
    ).rejects.toBeInstanceOf(OrgParentingError);
  });

  it('creates a child under an allowed parent type', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    const company = await service.createNode({
      nodeType: 'legal_company',
      name: 'Co',
      parentId: group.id,
    });
    expect(company.parentId).toBe(group.id);
  });

  it('rejects a child under a disallowed parent type', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    await expect(
      service.createNode({ nodeType: 'warehouse', name: 'W', parentId: group.id }),
    ).rejects.toBeInstanceOf(OrgParentingError);
  });

  it('rejects a non-existent parent', async () => {
    const { service } = makeService();
    await expect(
      service.createNode({ nodeType: 'legal_company', name: 'Co', parentId: randomUUID() }),
    ).rejects.toBeInstanceOf(OrgNodeNotFoundError);
  });

  it('rejects an archived parent', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group', status: 'archived' });
    await expect(
      service.createNode({ nodeType: 'legal_company', name: 'Co', parentId: group.id }),
    ).rejects.toBeInstanceOf(OrgParentingError);
  });

  it('rejects a negative position', async () => {
    const { service } = makeService();
    await expect(
      service.createNode({ nodeType: 'group', name: 'HQ', parentId: null, position: -1 }),
    ).rejects.toBeInstanceOf(OrgNodeValidationError);
  });
});

describe('OrganizationService.updateNode', () => {
  it('renames a node', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group', name: 'Old' });
    const updated = await service.updateNode(group.id, { name: '  New  ' });
    expect(updated.name).toBe('New');
  });

  it('rejects a blank rename', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    await expect(service.updateNode(group.id, { name: '  ' })).rejects.toBeInstanceOf(
      OrgNodeValidationError,
    );
  });

  it('rejects updating a non-existent node', async () => {
    const { service } = makeService();
    await expect(service.updateNode(randomUUID(), { name: 'X' })).rejects.toBeInstanceOf(
      OrgNodeNotFoundError,
    );
  });

  it('rejects updating an archived node', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group', status: 'archived' });
    await expect(service.updateNode(group.id, { name: 'X' })).rejects.toBeInstanceOf(
      OrgLifecycleError,
    );
  });

  it('moves a node to an allowed parent', async () => {
    const { service, repo } = makeService();
    const groupA = repo.seed({ nodeType: 'group' });
    const groupB = repo.seed({ nodeType: 'group' });
    const company = repo.seed({ nodeType: 'legal_company', parentId: groupA.id });

    const moved = await service.updateNode(company.id, { parentId: groupB.id });
    expect(moved.parentId).toBe(groupB.id);
  });

  it('rejects a move to a disallowed parent type', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    const branch = repo.seed({ nodeType: 'branch' });
    // branch is not allowed directly under group in the fake rules
    await expect(service.updateNode(branch.id, { parentId: group.id })).rejects.toBeInstanceOf(
      OrgParentingError,
    );
  });

  it('rejects making a node its own parent', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    await expect(service.updateNode(group.id, { parentId: group.id })).rejects.toBeInstanceOf(
      OrgParentingError,
    );
  });

  it('rejects a move that would create a cycle', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    const company = repo.seed({ nodeType: 'legal_company', parentId: group.id });
    const branch = repo.seed({ nodeType: 'branch', parentId: company.id });
    const dept = repo.seed({ nodeType: 'department', parentId: branch.id });
    const subDept = repo.seed({ nodeType: 'department', parentId: dept.id });

    // department-under-department is allowed by type, but subDept is dept's
    // descendant, so moving dept under subDept is a cycle.
    await expect(service.updateNode(dept.id, { parentId: subDept.id })).rejects.toBeInstanceOf(
      OrgCycleError,
    );
  });

  it('moves a node back to the root when its type allows it', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    const company = repo.seed({ nodeType: 'legal_company', parentId: group.id });

    const moved = await service.updateNode(company.id, { parentId: null });
    expect(moved.parentId).toBeNull();
  });

  it('rejects moving a non-root type to the root', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    const company = repo.seed({ nodeType: 'legal_company', parentId: group.id });
    const branch = repo.seed({ nodeType: 'branch', parentId: company.id });

    await expect(service.updateNode(branch.id, { parentId: null })).rejects.toBeInstanceOf(
      OrgParentingError,
    );
  });

  it('is a no-op when the patch is empty', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group', name: 'Same' });
    const result = await service.updateNode(group.id, {});
    expect(result.name).toBe('Same');
  });
});

describe('OrganizationService.archiveNode', () => {
  it('archives a leaf node', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    const archived = await service.archiveNode(group.id);
    expect(archived.status).toBe('archived');
  });

  it('is idempotent on an already-archived node', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group', status: 'archived' });
    const result = await service.archiveNode(group.id);
    expect(result.status).toBe('archived');
  });

  it('refuses to archive a node that still has non-archived children', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    repo.seed({ nodeType: 'legal_company', parentId: group.id });

    await expect(service.archiveNode(group.id)).rejects.toBeInstanceOf(OrgLifecycleError);
  });

  it('archives a node whose only children are already archived', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    repo.seed({ nodeType: 'legal_company', parentId: group.id, status: 'archived' });

    const archived = await service.archiveNode(group.id);
    expect(archived.status).toBe('archived');
  });

  it('rejects archiving a non-existent node', async () => {
    const { service } = makeService();
    await expect(service.archiveNode(randomUUID())).rejects.toBeInstanceOf(OrgNodeNotFoundError);
  });
});

describe('OrganizationService read APIs', () => {
  it('getNode returns the node or throws not-found', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group', name: 'HQ' });

    await expect(service.getNode(group.id)).resolves.toMatchObject({ name: 'HQ' });
    await expect(service.getNode(randomUUID())).rejects.toBeInstanceOf(OrgNodeNotFoundError);
  });

  it('getSubtree nests the node with its descendants', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    const company = repo.seed({ nodeType: 'legal_company', parentId: group.id });
    const branch = repo.seed({ nodeType: 'branch', name: 'B', parentId: company.id });
    repo.seed({ nodeType: 'group', name: 'unrelated' });

    const subtree = await service.getSubtree(company.id);
    expect(subtree.id).toBe(company.id);
    expect(subtree.children[0]?.id).toBe(branch.id);
  });

  it('getSubtree throws not-found for an unknown id', async () => {
    const { service } = makeService();
    await expect(service.getSubtree(randomUUID())).rejects.toBeInstanceOf(OrgNodeNotFoundError);
  });

  it('getAncestors returns the chain root-first without the node', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group', name: 'G' });
    const company = repo.seed({ nodeType: 'legal_company', name: 'C', parentId: group.id });
    const branch = repo.seed({ nodeType: 'branch', name: 'B', parentId: company.id });

    const result = await service.getAncestors(branch.id);
    expect(result.node.id).toBe(branch.id);
    expect(result.ancestors.map((a) => a.name)).toEqual(['G', 'C']);
  });

  it('getAncestors returns an empty chain for a root', async () => {
    const { service, repo } = makeService();
    const group = repo.seed({ nodeType: 'group' });
    await expect(service.getAncestors(group.id)).resolves.toMatchObject({ ancestors: [] });
  });

  it('getNodeTypes attaches allowed parent types to each type', async () => {
    const { service } = makeService();
    const types = await service.getNodeTypes();

    const branch = types.find((t) => t.code === 'branch');
    expect(branch).toEqual({
      code: 'branch',
      label: 'Branch',
      canBeRoot: false,
      allowedParentTypes: ['legal_company'],
    });
    expect(types.find((t) => t.code === 'group')?.allowedParentTypes).toEqual([]);
  });
});
