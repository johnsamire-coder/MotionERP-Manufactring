import type { OrgNodeRecord, OrgNodeTypeSummary, OrgTreeNode } from './organization.types';

/**
 * Build a forest (list of root nodes with nested `children`) from a flat list.
 *
 * Pure and defensive:
 * - siblings are ordered by `position`, then `name`, then `id`;
 * - a node whose `parentId` is not in the input is treated as a root, so data
 *   is never silently hidden;
 * - nodes caught in a parent/child cycle (which the database forbids) simply do
 *   not appear; the function never loops forever.
 */
export function buildForest(records: readonly OrgNodeRecord[]): OrgTreeNode[] {
  const nodes = new Map<string, OrgTreeNode>();
  for (const record of records) {
    nodes.set(record.id, { ...record, children: [] });
  }

  const roots: OrgTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortRecursively(roots);
  return roots;
}

function sortRecursively(siblings: OrgTreeNode[]): void {
  siblings.sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  for (const sibling of siblings) {
    sortRecursively(sibling.children);
  }
}

/** The node with the given id plus every descendant of it (flat). Empty if not found. */
export function collectSubtree(records: readonly OrgNodeRecord[], rootId: string): OrgNodeRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  if (!byId.has(rootId)) return [];

  const childrenOf = new Map<string, OrgNodeRecord[]>();
  for (const record of records) {
    if (record.parentId !== null) {
      const siblings = childrenOf.get(record.parentId) ?? [];
      siblings.push(record);
      childrenOf.set(record.parentId, siblings);
    }
  }

  const collected: OrgNodeRecord[] = [];
  const seen = new Set<string>();
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) collected.push(node);
    for (const child of childrenOf.get(id) ?? []) {
      queue.push(child.id);
    }
  }
  return collected;
}

/** Ancestor chain of `nodeId`, root first, excluding the node itself. */
export function collectAncestors(
  records: readonly OrgNodeRecord[],
  nodeId: string,
): OrgNodeRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const start = byId.get(nodeId);
  if (!start) return [];

  const chain: OrgNodeRecord[] = [];
  const seen = new Set<string>([nodeId]);
  let current = start.parentId;
  while (current !== null && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    const parent = byId.get(current)!;
    chain.unshift(parent);
    current = parent.parentId;
  }
  return chain;
}

/** Fold the flat parent-rule list into each node type as `allowedParentTypes`. */
export function assembleNodeTypes(
  types: ReadonlyArray<{ code: string; label: string; canBeRoot: boolean }>,
  rules: ReadonlyArray<{ childType: string; parentType: string }>,
): OrgNodeTypeSummary[] {
  const allowed = new Map<string, string[]>();
  for (const rule of rules) {
    const parents = allowed.get(rule.childType) ?? [];
    parents.push(rule.parentType);
    allowed.set(rule.childType, parents);
  }

  return types.map((type) => ({
    code: type.code,
    label: type.label,
    canBeRoot: type.canBeRoot,
    allowedParentTypes: [...(allowed.get(type.code) ?? [])].sort((a, b) => a.localeCompare(b)),
  }));
}
