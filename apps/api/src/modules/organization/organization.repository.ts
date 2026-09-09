import { Injectable } from '@nestjs/common';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { orgNode, orgNodeParentRule, orgNodeType } from './organization.schema';
import type { OrgNodeRecord, OrgNodeStatus, OrgNodeTypeRecord } from './organization.types';

export interface InsertOrgNodeData {
  id: string;
  nodeType: string;
  name: string;
  parentId: string | null;
  position: number;
}

const nodeColumns = {
  id: orgNode.id,
  nodeType: orgNode.nodeType,
  name: orgNode.name,
  parentId: orgNode.parentId,
  status: orgNode.status,
  position: orgNode.position,
  createdAt: orgNode.createdAt,
  updatedAt: orgNode.updatedAt,
};

interface NodeRow {
  id: string;
  nodeType: string;
  name: string;
  parentId: string | null;
  status: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(row: NodeRow): OrgNodeRecord {
  return {
    id: row.id,
    nodeType: row.nodeType,
    name: row.name,
    parentId: row.parentId,
    status: row.status as OrgNodeStatus,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The only place that reads/writes the `platform.org_node*` tables.
 *
 * Other modules never touch these tables directly — they go through the
 * organization module's public surface (D2 / D20).
 */
@Injectable()
export class OrganizationRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAllNodes(): Promise<OrgNodeRecord[]> {
    const rows = await this.database.db
      .select(nodeColumns)
      .from(orgNode)
      .orderBy(asc(orgNode.position), asc(orgNode.name));
    return rows.map(toRecord);
  }

  async findNodeById(id: string): Promise<OrgNodeRecord | null> {
    const rows = await this.database.db
      .select(nodeColumns)
      .from(orgNode)
      .where(eq(orgNode.id, id))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findNodeType(code: string): Promise<OrgNodeTypeRecord | null> {
    const rows = await this.database.db
      .select({ code: orgNodeType.code, canBeRoot: orgNodeType.canBeRoot })
      .from(orgNodeType)
      .where(eq(orgNodeType.code, code))
      .limit(1);
    return rows[0] ?? null;
  }

  /** The full node-type vocabulary, ordered by code. */
  async listNodeTypes(): Promise<Array<{ code: string; label: string; canBeRoot: boolean }>> {
    return this.database.db
      .select({
        code: orgNodeType.code,
        label: orgNodeType.label,
        canBeRoot: orgNodeType.canBeRoot,
      })
      .from(orgNodeType)
      .orderBy(asc(orgNodeType.code));
  }

  /** Every allowed (childType -> parentType) pair (D10). */
  async listParentRules(): Promise<Array<{ childType: string; parentType: string }>> {
    return this.database.db
      .select({
        childType: orgNodeParentRule.childType,
        parentType: orgNodeParentRule.parentType,
      })
      .from(orgNodeParentRule)
      .orderBy(asc(orgNodeParentRule.childType), asc(orgNodeParentRule.parentType));
  }

  /** Is a `childType` node allowed to have a `parentType` parent? (D10) */
  async isParentingAllowed(childType: string, parentType: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ one: sql<number>`1` })
      .from(orgNodeParentRule)
      .where(
        and(
          eq(orgNodeParentRule.childType, childType),
          eq(orgNodeParentRule.parentType, parentType),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** Ids of every ancestor of `nodeId` (excludes the node itself). */
  async listAncestorIds(nodeId: string): Promise<string[]> {
    const result = await this.database.db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT ${orgNode.id} AS id, ${orgNode.parentId} AS parent_id
          FROM ${orgNode}
          WHERE ${orgNode.id} = ${nodeId}
        UNION ALL
        SELECT n.id, n.parent_id
          FROM ${orgNode} n
          JOIN ancestors a ON n.id = a.parent_id
      )
      SELECT id FROM ancestors WHERE id <> ${nodeId}
    `);
    return (result.rows as Array<{ id: string }>).map((row) => row.id);
  }

  async countActiveChildren(nodeId: string): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(orgNode)
      .where(and(eq(orgNode.parentId, nodeId), ne(orgNode.status, 'archived')));
    return rows[0]?.count ?? 0;
  }

  async insertNode(input: InsertOrgNodeData): Promise<OrgNodeRecord> {
    const rows = await this.database.db
      .insert(orgNode)
      .values({
        id: input.id,
        nodeType: input.nodeType,
        name: input.name,
        parentId: input.parentId,
        position: input.position,
      })
      .returning(nodeColumns);
    return toRecord(rows[0]!);
  }

  async updateNodeFields(
    id: string,
    fields: { name?: string; position?: number; parentId?: string | null },
  ): Promise<OrgNodeRecord> {
    const rows = await this.database.db
      .update(orgNode)
      .set(fields)
      .where(eq(orgNode.id, id))
      .returning(nodeColumns);
    return toRecord(rows[0]!);
  }

  async setNodeStatus(id: string, status: OrgNodeStatus): Promise<OrgNodeRecord> {
    const rows = await this.database.db
      .update(orgNode)
      .set({ status })
      .where(eq(orgNode.id, id))
      .returning(nodeColumns);
    return toRecord(rows[0]!);
  }
}
