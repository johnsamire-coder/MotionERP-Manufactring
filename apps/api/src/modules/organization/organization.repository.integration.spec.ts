import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { AppConfigService } from '../../core/config/app-config.service';
import { DatabaseService } from '../../core/database/database.service';
import { getMigrationStatus, runMigrations } from '../../core/database/migrator';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

/**
 * Integration tests for the organizational core: they apply the real migration
 * to a real PostgreSQL and exercise the table's constraints and the
 * repository -> service path.
 *
 * When no database is reachable the suite reports SKIPPED and passes (a
 * developer without Docker is not blocked). CI always runs it for real.
 */
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const BOOKKEEPING_SCHEMA = 'org_b22_bookkeeping';

async function canConnect(url: string): Promise<boolean> {
  if (!url) return false;
  const probe = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 2500 });
  try {
    await probe.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end();
  }
}

describe('organizational core (integration, requires PostgreSQL)', () => {
  let dbAvailable = false;
  let pool: Pool;
  let database: DatabaseService;
  let repository: OrganizationRepository;
  let service: OrganizationService;

  async function resetSchemas(): Promise<void> {
    await pool.query('drop schema if exists "platform" cascade');
    await pool.query(`drop schema if exists "${BOOKKEEPING_SCHEMA}" cascade`);
  }

  async function insertNode(fields: {
    id?: string;
    nodeType?: string;
    name?: string;
    parentId?: string | null;
    status?: string;
    position?: number;
  }): Promise<string> {
    const id = fields.id ?? randomUUID();
    await pool.query(
      `insert into "platform"."org_node" (id, node_type, name, parent_id, status, position)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        fields.nodeType ?? 'branch',
        fields.name ?? 'Node',
        fields.parentId ?? null,
        fields.status ?? 'active',
        fields.position ?? 0,
      ],
    );
    return id;
  }

  beforeAll(async () => {
    dbAvailable = await canConnect(DATABASE_URL);
    if (!dbAvailable) {
      console.warn(
        '[b-2-2] SKIPPED organization integration tests: no reachable PostgreSQL at DATABASE_URL. ' +
          'Start one with `pnpm run db:up` (needs Docker) or point DATABASE_URL at a test database.',
      );
      return;
    }
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    await resetSchemas();
    await runMigrations({ databaseUrl: DATABASE_URL, migrationsSchema: BOOKKEEPING_SCHEMA });

    database = new DatabaseService({ databaseUrl: DATABASE_URL } as unknown as AppConfigService);
    repository = new OrganizationRepository(database);
    service = new OrganizationService(repository);
  }, 30000);

  afterEach(async () => {
    if (dbAvailable) await pool.query('delete from "platform"."org_node"');
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await database.onModuleDestroy();
    await resetSchemas();
    await pool.end();
  });

  it('applied the migration: schema, table and seeded node types exist', async () => {
    if (!dbAvailable) return;

    const table = await pool.query<{ present: boolean }>(
      `select to_regclass('"platform"."org_node"') is not null as present`,
    );
    expect(table.rows[0]?.present).toBe(true);

    const types = await pool.query<{ count: string }>(
      'select count(*)::text as count from "platform"."org_node_type"',
    );
    expect(Number(types.rows[0]?.count)).toBe(13);
  });

  it('creates a root node and reads it back as a one-node tree', async () => {
    if (!dbAvailable) return;

    await insertNode({ nodeType: 'group', name: 'Root Group', parentId: null });

    const tree = await service.getTree();
    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe('Root Group');
    expect(tree[0]?.status).toBe('active');
    expect(tree[0]?.children).toEqual([]);
  });

  it('nests a child node under its parent', async () => {
    if (!dbAvailable) return;

    const company = await insertNode({ nodeType: 'legal_company', name: 'Company One' });
    await insertNode({ nodeType: 'branch', name: 'Branch A', parentId: company });

    const tree = await service.getTree();
    expect(tree[0]?.children.map((c) => c.name)).toEqual(['Branch A']);
  });

  it('builds multiple levels', async () => {
    if (!dbAvailable) return;

    const group = await insertNode({ nodeType: 'group', name: 'G' });
    const company = await insertNode({ nodeType: 'legal_company', name: 'C', parentId: group });
    const factory = await insertNode({ nodeType: 'factory', name: 'F', parentId: company });
    await insertNode({ nodeType: 'work_center', name: 'W', parentId: factory });

    const tree = await service.getTree();
    expect(tree[0]?.children[0]?.children[0]?.children[0]?.name).toBe('W');
  });

  it('rejects a node whose parent does not exist', async () => {
    if (!dbAvailable) return;
    await expect(insertNode({ parentId: randomUUID() })).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects a node that references an unknown node type', async () => {
    if (!dbAvailable) return;
    await expect(insertNode({ nodeType: 'not_a_type' })).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects a node that is its own parent', async () => {
    if (!dbAvailable) return;
    const id = randomUUID();
    await expect(insertNode({ id, parentId: id })).rejects.toMatchObject({ code: '23514' });
  });

  it('prevents a cycle created by a later update', async () => {
    if (!dbAvailable) return;

    const a = await insertNode({ name: 'A' });
    const b = await insertNode({ name: 'B', parentId: a });

    await expect(
      pool.query('update "platform"."org_node" set parent_id = $1 where id = $2', [b, a]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses to delete a node that still has children', async () => {
    if (!dbAvailable) return;

    const parent = await insertNode({ name: 'Parent' });
    await insertNode({ name: 'Child', parentId: parent });

    // ON DELETE RESTRICT raises restrict_violation (23001), checked immediately.
    await expect(
      pool.query('delete from "platform"."org_node" where id = $1', [parent]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('defaults status to active and rejects an invalid status', async () => {
    if (!dbAvailable) return;

    const id = randomUUID();
    await pool.query(
      `insert into "platform"."org_node" (id, node_type, name) values ($1, 'branch', 'Defaulted')`,
      [id],
    );
    const row = await pool.query<{ status: string }>(
      'select status from "platform"."org_node" where id = $1',
      [id],
    );
    expect(row.rows[0]?.status).toBe('active');

    await expect(insertNode({ status: 'deleted' })).rejects.toMatchObject({ code: '23514' });
  });

  it('requires a non-blank name', async () => {
    if (!dbAvailable) return;

    await expect(
      pool.query(`insert into "platform"."org_node" (node_type, name) values ('branch', NULL)`),
    ).rejects.toMatchObject({ code: '23502' });

    await expect(insertNode({ name: '   ' })).rejects.toMatchObject({ code: '23514' });
  });

  it('touches updated_at on every update', async () => {
    if (!dbAvailable) return;

    const id = await insertNode({ name: 'Before' });
    const first = await pool.query<{ updated_at: Date }>(
      'select updated_at from "platform"."org_node" where id = $1',
      [id],
    );

    await new Promise((resolve) => setTimeout(resolve, 15));
    await pool.query('update "platform"."org_node" set name = $1 where id = $2', ['After', id]);

    const second = await pool.query<{ updated_at: Date }>(
      'select updated_at from "platform"."org_node" where id = $1',
      [id],
    );
    expect(second.rows[0]!.updated_at.getTime()).toBeGreaterThan(
      first.rows[0]!.updated_at.getTime(),
    );
  });

  // ---------------------------------------------------------------------------
  // Phase B-2-3: parent-type rules + write operations through the service.
  // ---------------------------------------------------------------------------

  describe('migration 0001 (parent rules)', () => {
    it('created the rule table and seeded root flags + rules', async () => {
      if (!dbAvailable) return;

      const rootTypes = await pool.query<{ code: string }>(
        `select code from "platform"."org_node_type" where can_be_root order by code`,
      );
      expect(rootTypes.rows.map((r) => r.code)).toEqual(['group', 'legal_company']);

      const ruleCount = await pool.query<{ count: string }>(
        'select count(*)::text as count from "platform"."org_node_parent_rule"',
      );
      expect(Number(ruleCount.rows[0]?.count)).toBeGreaterThanOrEqual(30);

      const specific = await pool.query(
        `select 1 from "platform"."org_node_parent_rule"
         where child_type = 'legal_company' and parent_type = 'group'`,
      );
      expect(specific.rowCount).toBe(1);
    });

    it('re-running the migrations applies nothing new (idempotent)', async () => {
      if (!dbAvailable) return;

      const before = await getMigrationStatus({
        databaseUrl: DATABASE_URL,
        migrationsSchema: BOOKKEEPING_SCHEMA,
      });
      expect(before).toHaveLength(2);
      expect(before.every((m) => m.applied)).toBe(true);

      await runMigrations({ databaseUrl: DATABASE_URL, migrationsSchema: BOOKKEEPING_SCHEMA });

      const after = await getMigrationStatus({
        databaseUrl: DATABASE_URL,
        migrationsSchema: BOOKKEEPING_SCHEMA,
      });
      expect(after.map((m) => m.tag)).toEqual(before.map((m) => m.tag));

      const ruleCount = await pool.query<{ count: string }>(
        'select count(*)::text as count from "platform"."org_node_parent_rule"',
      );
      expect(Number(ruleCount.rows[0]?.count)).toBeGreaterThanOrEqual(30);
    });
  });

  describe('repository helpers', () => {
    it('findNodeType returns the root flag', async () => {
      if (!dbAvailable) return;
      await expect(repository.findNodeType('group')).resolves.toEqual({
        code: 'group',
        canBeRoot: true,
      });
      await expect(repository.findNodeType('branch')).resolves.toEqual({
        code: 'branch',
        canBeRoot: false,
      });
      await expect(repository.findNodeType('nope')).resolves.toBeNull();
    });

    it('isParentingAllowed reflects the seeded rules', async () => {
      if (!dbAvailable) return;
      await expect(repository.isParentingAllowed('legal_company', 'group')).resolves.toBe(true);
      await expect(repository.isParentingAllowed('warehouse', 'group')).resolves.toBe(false);
    });

    it('listAncestorIds walks up the tree', async () => {
      if (!dbAvailable) return;
      const g = await insertNode({ nodeType: 'group', name: 'G', parentId: null });
      const c = await insertNode({ nodeType: 'legal_company', name: 'C', parentId: g });
      const b = await insertNode({ nodeType: 'branch', name: 'B', parentId: c });

      const ancestors = await repository.listAncestorIds(b);
      expect(new Set(ancestors)).toEqual(new Set([g, c]));
    });

    it('countActiveChildren ignores archived children', async () => {
      if (!dbAvailable) return;
      const g = await insertNode({ nodeType: 'group', name: 'G', parentId: null });
      await insertNode({ nodeType: 'legal_company', name: 'C1', parentId: g });
      await insertNode({ nodeType: 'legal_company', name: 'C2', parentId: g, status: 'archived' });

      await expect(repository.countActiveChildren(g)).resolves.toBe(1);
    });
  });

  describe('service write operations', () => {
    async function seedGroup(name = 'Group'): Promise<string> {
      return insertNode({ nodeType: 'group', name, parentId: null });
    }

    it('creates a root and a child through the service', async () => {
      if (!dbAvailable) return;

      const root = await service.createNode({ nodeType: 'group', name: 'Root', parentId: null });
      expect(root.parentId).toBeNull();

      const child = await service.createNode({
        nodeType: 'legal_company',
        name: 'Child',
        parentId: root.id,
      });
      expect(child.parentId).toBe(root.id);

      const tree = await service.getTree();
      expect(tree[0]?.children[0]?.name).toBe('Child');
    });

    it('rejects a disallowed parent type', async () => {
      if (!dbAvailable) return;
      const g = await seedGroup();
      await expect(
        service.createNode({ nodeType: 'warehouse', name: 'W', parentId: g }),
      ).rejects.toMatchObject({ name: 'OrgParentingError' });
    });

    it('rejects an archived parent', async () => {
      if (!dbAvailable) return;
      const g = await insertNode({
        nodeType: 'group',
        name: 'G',
        parentId: null,
        status: 'archived',
      });
      await expect(
        service.createNode({ nodeType: 'legal_company', name: 'C', parentId: g }),
      ).rejects.toMatchObject({ name: 'OrgParentingError' });
    });

    it('renames and moves a node', async () => {
      if (!dbAvailable) return;
      const g1 = await seedGroup('G1');
      const g2 = await seedGroup('G2');
      const company = await service.createNode({
        nodeType: 'legal_company',
        name: 'Old',
        parentId: g1,
      });

      const renamed = await service.updateNode(company.id, { name: 'New' });
      expect(renamed.name).toBe('New');

      const moved = await service.updateNode(company.id, { parentId: g2 });
      expect(moved.parentId).toBe(g2);
    });

    it('rejects a move that would create a cycle', async () => {
      if (!dbAvailable) return;
      const g = await seedGroup();
      const company = await service.createNode({
        nodeType: 'legal_company',
        name: 'C',
        parentId: g,
      });
      const branch = await service.createNode({
        nodeType: 'branch',
        name: 'B',
        parentId: company.id,
      });
      const dept = await service.createNode({
        nodeType: 'department',
        name: 'D',
        parentId: branch.id,
      });
      const subDept = await service.createNode({
        nodeType: 'department',
        name: 'D2',
        parentId: dept.id,
      });

      // department-under-department is allowed; the cycle is what must be rejected.
      await expect(service.updateNode(dept.id, { parentId: subDept.id })).rejects.toMatchObject({
        name: 'OrgCycleError',
      });
    });

    it('archives a leaf and keeps it in the tree with archived status', async () => {
      if (!dbAvailable) return;
      const g = await seedGroup();
      const company = await service.createNode({
        nodeType: 'legal_company',
        name: 'C',
        parentId: g,
      });

      const archived = await service.archiveNode(company.id);
      expect(archived.status).toBe('archived');

      const tree = await service.getTree();
      expect(tree[0]?.children[0]?.status).toBe('archived');
    });

    it('refuses to archive a node that still has active children', async () => {
      if (!dbAvailable) return;
      const g = await seedGroup();
      await service.createNode({ nodeType: 'legal_company', name: 'C', parentId: g });

      await expect(service.archiveNode(g)).rejects.toMatchObject({ name: 'OrgLifecycleError' });
    });

    it('rejects modifying an archived node', async () => {
      if (!dbAvailable) return;
      const g = await seedGroup();
      await service.archiveNode(g);
      await expect(service.updateNode(g, { name: 'X' })).rejects.toMatchObject({
        name: 'OrgLifecycleError',
      });
    });
  });

  describe('read APIs (B-2-4)', () => {
    async function buildSampleTree(): Promise<{ group: string; company: string; branch: string }> {
      const group = await insertNode({ nodeType: 'group', name: 'G', parentId: null });
      const company = await insertNode({ nodeType: 'legal_company', name: 'C', parentId: group });
      const branch = await insertNode({ nodeType: 'branch', name: 'B', parentId: company });
      await insertNode({ nodeType: 'department', name: 'D', parentId: branch });
      return { group, company, branch };
    }

    it('getNode returns a stored node and throws for an unknown id', async () => {
      if (!dbAvailable) return;
      const { company } = await buildSampleTree();

      await expect(service.getNode(company)).resolves.toMatchObject({
        name: 'C',
        nodeType: 'legal_company',
      });
      await expect(service.getNode(randomUUID())).rejects.toMatchObject({
        name: 'OrgNodeNotFoundError',
      });
    });

    it('getSubtree returns the node nested with its descendants only', async () => {
      if (!dbAvailable) return;
      const { company, branch } = await buildSampleTree();

      const subtree = await service.getSubtree(company);
      expect(subtree.id).toBe(company);
      expect(subtree.children[0]?.id).toBe(branch);
      expect(subtree.children[0]?.children[0]?.name).toBe('D');
    });

    it('getAncestors returns the chain root-first without the node', async () => {
      if (!dbAvailable) return;
      const { group, company, branch } = await buildSampleTree();

      const result = await service.getAncestors(branch);
      expect(result.node.id).toBe(branch);
      expect(result.ancestors.map((a) => a.id)).toEqual([group, company]);
    });

    it('getNodeTypes returns all 13 types with labels and allowed parents', async () => {
      if (!dbAvailable) return;

      const types = await service.getNodeTypes();
      expect(types).toHaveLength(13);

      const legalCompany = types.find((t) => t.code === 'legal_company');
      expect(legalCompany?.canBeRoot).toBe(true);
      expect(legalCompany?.label).toBe('Legal company');
      expect(legalCompany?.allowedParentTypes).toEqual(['group']);

      const branch = types.find((t) => t.code === 'branch');
      expect(branch?.canBeRoot).toBe(false);
      expect(branch?.allowedParentTypes).toEqual(
        [...(branch?.allowedParentTypes ?? [])].sort((a, b) => a.localeCompare(b)),
      );
      expect(branch?.allowedParentTypes).toContain('legal_company');
    });
  });
});
