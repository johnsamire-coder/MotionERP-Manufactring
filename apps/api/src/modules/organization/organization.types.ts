export const ORG_NODE_STATUSES = ['active', 'inactive', 'archived'] as const;
export type OrgNodeStatus = (typeof ORG_NODE_STATUSES)[number];

/** One organizational node as stored (flat). */
export interface OrgNodeRecord {
  id: string;
  nodeType: string;
  name: string;
  parentId: string | null;
  status: OrgNodeStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** One node with its descendants nested underneath it. */
export interface OrgTreeNode extends OrgNodeRecord {
  children: OrgTreeNode[];
}

export interface OrgNodeTypeRecord {
  code: string;
  canBeRoot: boolean;
}

/** A node type plus the types it is allowed to sit under (for read APIs). */
export interface OrgNodeTypeSummary {
  code: string;
  label: string;
  canBeRoot: boolean;
  allowedParentTypes: string[];
}

/** A node together with its ancestor chain (root first, excludes the node). */
export interface OrgNodeWithAncestors {
  node: OrgNodeRecord;
  ancestors: OrgNodeRecord[];
}

/** Input to create a node. `parentId: null` => a root node. */
export interface CreateOrgNodeInput {
  nodeType: string;
  name: string;
  parentId: string | null;
  position?: number;
}

/**
 * Input to update a node. A key that is present means "change this".
 * `parentId` present (string or null) means "move"; absent means "leave the parent".
 */
export interface UpdateOrgNodeInput {
  name?: string;
  position?: number;
  parentId?: string | null;
}
