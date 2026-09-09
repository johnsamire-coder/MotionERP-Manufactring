import {
  assembleNodeTypes,
  buildForest,
  collectAncestors,
  collectSubtree,
} from './organization.tree';
import type { OrgNodeRecord } from './organization.types';

function node(partial: Partial<OrgNodeRecord> & Pick<OrgNodeRecord, 'id'>): OrgNodeRecord {
  return {
    nodeType: 'branch',
    name: partial.id,
    parentId: null,
    status: 'active',
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('buildForest', () => {
  it('returns an empty forest for no records', () => {
    expect(buildForest([])).toEqual([]);
  });

  it('keeps a single root node', () => {
    const forest = buildForest([node({ id: 'root', nodeType: 'group' })]);
    expect(forest).toHaveLength(1);
    expect(forest[0]?.id).toBe('root');
    expect(forest[0]?.children).toEqual([]);
  });

  it('nests a child under its parent', () => {
    const forest = buildForest([
      node({ id: 'company', parentId: null }),
      node({ id: 'branch', parentId: 'company' }),
    ]);

    expect(forest).toHaveLength(1);
    expect(forest[0]?.id).toBe('company');
    expect(forest[0]?.children.map((c) => c.id)).toEqual(['branch']);
  });

  it('builds more than one level deep', () => {
    const forest = buildForest([
      node({ id: 'group', parentId: null }),
      node({ id: 'company', parentId: 'group' }),
      node({ id: 'factory', parentId: 'company' }),
      node({ id: 'line', parentId: 'factory' }),
    ]);

    expect(forest[0]?.children[0]?.children[0]?.children[0]?.id).toBe('line');
  });

  it('orders siblings by position, then name', () => {
    const forest = buildForest([
      node({ id: 'p', parentId: null }),
      node({ id: 'c-b', name: 'Bravo', parentId: 'p', position: 2 }),
      node({ id: 'c-a', name: 'Alpha', parentId: 'p', position: 2 }),
      node({ id: 'c-first', name: 'Zulu', parentId: 'p', position: 1 }),
    ]);

    expect(forest[0]?.children.map((c) => c.id)).toEqual(['c-first', 'c-a', 'c-b']);
  });

  it('supports multiple roots', () => {
    const forest = buildForest([node({ id: 'r1', position: 1 }), node({ id: 'r2', position: 0 })]);
    expect(forest.map((r) => r.id)).toEqual(['r2', 'r1']);
  });

  it('treats a node with an unknown parent as a root instead of hiding it', () => {
    const forest = buildForest([node({ id: 'orphan', parentId: 'missing' })]);
    expect(forest.map((r) => r.id)).toEqual(['orphan']);
  });
});

const sampleTree: OrgNodeRecord[] = [
  node({ id: 'g' }),
  node({ id: 'c1', parentId: 'g' }),
  node({ id: 'c2', parentId: 'g' }),
  node({ id: 'b1', parentId: 'c1' }),
  node({ id: 'b2', parentId: 'c1' }),
  node({ id: 'w1', parentId: 'b1' }),
  node({ id: 'other-root' }),
];

describe('collectSubtree', () => {
  it('returns the node and all of its descendants', () => {
    const ids = collectSubtree(sampleTree, 'c1')
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual(['b1', 'b2', 'c1', 'w1']);
  });

  it('returns just the node when it is a leaf', () => {
    expect(collectSubtree(sampleTree, 'w1').map((r) => r.id)).toEqual(['w1']);
  });

  it('returns an empty list for an unknown id', () => {
    expect(collectSubtree(sampleTree, 'nope')).toEqual([]);
  });
});

describe('collectAncestors', () => {
  it('returns the chain root-first, excluding the node itself', () => {
    expect(collectAncestors(sampleTree, 'w1').map((r) => r.id)).toEqual(['g', 'c1', 'b1']);
  });

  it('returns an empty list for a root', () => {
    expect(collectAncestors(sampleTree, 'g')).toEqual([]);
  });

  it('returns an empty list for an unknown id', () => {
    expect(collectAncestors(sampleTree, 'nope')).toEqual([]);
  });
});

describe('assembleNodeTypes', () => {
  it('folds parent rules into each type as a sorted list', () => {
    const result = assembleNodeTypes(
      [
        { code: 'group', label: 'Group', canBeRoot: true },
        { code: 'branch', label: 'Branch', canBeRoot: false },
      ],
      [
        { childType: 'branch', parentType: 'region' },
        { childType: 'branch', parentType: 'activity' },
      ],
    );

    expect(result).toEqual([
      { code: 'group', label: 'Group', canBeRoot: true, allowedParentTypes: [] },
      {
        code: 'branch',
        label: 'Branch',
        canBeRoot: false,
        allowedParentTypes: ['activity', 'region'],
      },
    ]);
  });
});
