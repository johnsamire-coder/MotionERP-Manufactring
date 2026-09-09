import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  OrgCycleError,
  OrgLifecycleError,
  OrgNodeNotFoundError,
  OrgNodeValidationError,
  OrgParentingError,
} from './organization.errors';
import { OrganizationRepository } from './organization.repository';
import {
  assembleNodeTypes,
  buildForest,
  collectAncestors,
  collectSubtree,
} from './organization.tree';
import type {
  CreateOrgNodeInput,
  OrgNodeRecord,
  OrgNodeTypeSummary,
  OrgNodeWithAncestors,
  OrgTreeNode,
  UpdateOrgNodeInput,
} from './organization.types';

@Injectable()
export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}

  /** The whole organizational structure as a nested forest (may be empty). */
  async getTree(): Promise<OrgTreeNode[]> {
    const nodes = await this.repository.findAllNodes();
    return buildForest(nodes);
  }

  /** A single node, or 404. */
  async getNode(id: string): Promise<OrgNodeRecord> {
    const node = await this.repository.findNodeById(id);
    if (!node) {
      throw new OrgNodeNotFoundError(`org node ${id} does not exist`);
    }
    return node;
  }

  /** The node plus its descendants, nested. */
  async getSubtree(id: string): Promise<OrgTreeNode> {
    const all = await this.repository.findAllNodes();
    const inSubtree = collectSubtree(all, id);
    if (inSubtree.length === 0) {
      throw new OrgNodeNotFoundError(`org node ${id} does not exist`);
    }
    // The requested node is the only root of `inSubtree` (its parent is excluded).
    return buildForest(inSubtree)[0]!;
  }

  /** The node together with its ancestor chain (root first, excludes the node). */
  async getAncestors(id: string): Promise<OrgNodeWithAncestors> {
    const all = await this.repository.findAllNodes();
    const node = all.find((candidate) => candidate.id === id);
    if (!node) {
      throw new OrgNodeNotFoundError(`org node ${id} does not exist`);
    }
    return { node, ancestors: collectAncestors(all, id) };
  }

  /** The node-type vocabulary, each with the parent types it is allowed under. */
  async getNodeTypes(): Promise<OrgNodeTypeSummary[]> {
    const [types, rules] = await Promise.all([
      this.repository.listNodeTypes(),
      this.repository.listParentRules(),
    ]);
    return assembleNodeTypes(types, rules);
  }

  /**
   * Create a node. All checks run here (first line); the database keeps its
   * structural guards as the final line of defence (D10 / item 4).
   */
  async createNode(input: CreateOrgNodeInput): Promise<OrgNodeRecord> {
    const name = normalizeName(input.name);
    const position = normalizePosition(input.position ?? 0);

    const type = await this.repository.findNodeType(input.nodeType);
    if (!type) {
      throw new OrgNodeValidationError(`unknown node type: "${input.nodeType}"`);
    }

    if (input.parentId === null) {
      if (!type.canBeRoot) {
        throw new OrgParentingError(`a node of type "${type.code}" cannot be a root node`);
      }
    } else {
      await this.assertParentAccepts(type.code, input.parentId);
    }

    return this.repository.insertNode({
      id: randomUUID(),
      nodeType: type.code,
      name,
      parentId: input.parentId,
      position,
    });
  }

  /**
   * Update a node: rename, reposition and/or move it. A field is only touched
   * when it is present in `patch`. Archived nodes cannot be updated.
   */
  async updateNode(id: string, patch: UpdateOrgNodeInput): Promise<OrgNodeRecord> {
    const node = await this.repository.findNodeById(id);
    if (!node) {
      throw new OrgNodeNotFoundError(`org node ${id} does not exist`);
    }
    if (node.status === 'archived') {
      throw new OrgLifecycleError(`org node ${id} is archived and cannot be modified`);
    }

    const fields: { name?: string; position?: number; parentId?: string | null } = {};

    if (patch.name !== undefined) {
      fields.name = normalizeName(patch.name);
    }
    if (patch.position !== undefined) {
      fields.position = normalizePosition(patch.position);
    }
    if ('parentId' in patch) {
      const newParentId = patch.parentId ?? null;
      await this.assertMoveAllowed(node, newParentId);
      fields.parentId = newParentId;
    }

    if (Object.keys(fields).length === 0) {
      return node;
    }
    return this.repository.updateNodeFields(id, fields);
  }

  /**
   * Archive a node (soft removal — never a hard delete, D25).
   *
   * Only a leaf (no non-archived children) can be archived. The behaviour for a
   * node that still has children is NOT defined in the architecture decisions,
   * so this refuses rather than assuming a cascade or an allow (item 7).
   */
  async archiveNode(id: string): Promise<OrgNodeRecord> {
    const node = await this.repository.findNodeById(id);
    if (!node) {
      throw new OrgNodeNotFoundError(`org node ${id} does not exist`);
    }
    if (node.status === 'archived') {
      return node;
    }

    const activeChildren = await this.repository.countActiveChildren(id);
    if (activeChildren > 0) {
      throw new OrgLifecycleError(
        `org node ${id} still has ${activeChildren} non-archived child node(s); ` +
          'archiving a node with children is not yet defined — archive the children first',
      );
    }

    return this.repository.setNodeStatus(id, 'archived');
  }

  private async assertParentAccepts(childType: string, parentId: string): Promise<void> {
    const parent = await this.repository.findNodeById(parentId);
    if (!parent) {
      throw new OrgNodeNotFoundError(`parent node ${parentId} does not exist`);
    }
    if (parent.status === 'archived') {
      throw new OrgParentingError(`parent node ${parentId} is archived and cannot take children`);
    }
    const allowed = await this.repository.isParentingAllowed(childType, parent.nodeType);
    if (!allowed) {
      throw new OrgParentingError(
        `a node of type "${childType}" is not allowed under a parent of type "${parent.nodeType}"`,
      );
    }
  }

  private async assertMoveAllowed(node: OrgNodeRecord, newParentId: string | null): Promise<void> {
    if (newParentId === node.id) {
      throw new OrgParentingError('a node cannot be its own parent');
    }

    if (newParentId === null) {
      const type = await this.repository.findNodeType(node.nodeType);
      if (!type?.canBeRoot) {
        throw new OrgParentingError(`a node of type "${node.nodeType}" cannot be a root node`);
      }
      return;
    }

    await this.assertParentAccepts(node.nodeType, newParentId);

    const ancestorIds = await this.repository.listAncestorIds(newParentId);
    if (ancestorIds.includes(node.id)) {
      throw new OrgCycleError(`moving node ${node.id} under ${newParentId} would create a cycle`);
    }
  }
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new OrgNodeValidationError('name is required');
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new OrgNodeValidationError('name must not be blank');
  }
  return trimmed;
}

function normalizePosition(raw: number): number {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new OrgNodeValidationError('position must be a non-negative integer');
  }
  return raw;
}
