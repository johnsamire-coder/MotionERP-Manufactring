import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { runMigrations } from '../src/core/database/migrator';

/**
 * End-to-end proof of the full path for phase B-2-2:
 *   database -> repository -> service -> controller -> HTTP.
 *
 * Skips (and passes) when no PostgreSQL is reachable; runs fully in CI.
 */
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const BOOKKEEPING_SCHEMA = 'org_b22_e2e_bookkeeping';

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

describe('Organization tree (e2e)', () => {
  let dbAvailable = false;
  let app: INestApplication;
  let pool: Pool;

  async function resetSchemas(): Promise<void> {
    await pool.query('drop schema if exists "platform" cascade');
    await pool.query(`drop schema if exists "${BOOKKEEPING_SCHEMA}" cascade`);
  }

  beforeAll(async () => {
    dbAvailable = await canConnect(DATABASE_URL);
    if (!dbAvailable) {
      console.warn('[b-2-2] SKIPPED organization e2e: no reachable PostgreSQL at DATABASE_URL.');
      return;
    }

    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    await resetSchemas();
    await runMigrations({ databaseUrl: DATABASE_URL, migrationsSchema: BOOKKEEPING_SCHEMA });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 30000);

  afterEach(async () => {
    if (dbAvailable) await pool.query('delete from "platform"."org_node"');
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await app.close();
    await resetSchemas();
    await pool.end();
  });

  it('returns an empty tree when there are no nodes', async () => {
    if (!dbAvailable) return;

    const response = await request(app.getHttpServer())
      .get('/api/v1/organization/tree')
      .expect(200);
    expect(response.body).toEqual({ tree: [] });
  });

  it('returns the nested structure that is in the database', async () => {
    if (!dbAvailable) return;

    const group = randomUUID();
    const company = randomUUID();
    await pool.query(
      `insert into "platform"."org_node" (id, node_type, name, parent_id) values
        ($1, 'group', 'Root Group', null),
        ($2, 'legal_company', 'Company One', $1),
        ($3, 'branch', 'Branch A', $2)`,
      [group, company, randomUUID()],
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/organization/tree')
      .expect(200);

    expect(response.body.tree).toHaveLength(1);
    expect(response.body.tree[0].name).toBe('Root Group');
    expect(response.body.tree[0].children[0].name).toBe('Company One');
    expect(response.body.tree[0].children[0].children[0].name).toBe('Branch A');
  });

  // --- B-2-3: write endpoints ------------------------------------------------

  const http = (): ReturnType<typeof request> => request(app.getHttpServer());

  it('creates a root node and then a child through the API, visible in the tree', async () => {
    if (!dbAvailable) return;

    const rootRes = await http()
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'group', name: 'API Group' })
      .expect(201);
    const rootId = rootRes.body.node.id as string;
    expect(rootRes.body.node.parentId).toBeNull();

    await http()
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'legal_company', name: 'API Company', parentId: rootId })
      .expect(201);

    const tree = await http().get('/api/v1/organization/tree').expect(200);
    expect(tree.body.tree[0].name).toBe('API Group');
    expect(tree.body.tree[0].children[0].name).toBe('API Company');
  });

  it('rejects a disallowed parent type with 409', async () => {
    if (!dbAvailable) return;
    const root = await http()
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'group', name: 'G' })
      .expect(201);

    await http()
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'warehouse', name: 'W', parentId: root.body.node.id })
      .expect(409);
  });

  it('rejects a non-existent parent with 404 and a blank name with 400', async () => {
    if (!dbAvailable) return;

    await http()
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'legal_company', name: 'C', parentId: randomUUID() })
      .expect(404);

    await http()
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'group', name: '   ' })
      .expect(400);
  });

  it('renames, moves and archives a node, each reflected in the tree', async () => {
    if (!dbAvailable) return;

    const g1 = (
      await http().post('/api/v1/organization/nodes').send({ nodeType: 'group', name: 'G1' })
    ).body.node.id as string;
    const g2 = (
      await http().post('/api/v1/organization/nodes').send({ nodeType: 'group', name: 'G2' })
    ).body.node.id as string;
    const companyId = (
      await http()
        .post('/api/v1/organization/nodes')
        .send({ nodeType: 'legal_company', name: 'Old Name', parentId: g1 })
    ).body.node.id as string;

    await http()
      .patch(`/api/v1/organization/nodes/${companyId}`)
      .send({ name: 'New Name' })
      .expect(200);
    await http()
      .patch(`/api/v1/organization/nodes/${companyId}`)
      .send({ parentId: g2 })
      .expect(200);
    await http().post(`/api/v1/organization/nodes/${companyId}/archive`).expect(200);

    const tree = await http().get('/api/v1/organization/tree').expect(200);
    const g2Node = tree.body.tree.find((n: { id: string }) => n.id === g2);
    expect(g2Node.children[0].name).toBe('New Name');
    expect(g2Node.children[0].status).toBe('archived');
  });

  it('refuses to archive a node that still has children (409)', async () => {
    if (!dbAvailable) return;

    const rootId = (
      await http().post('/api/v1/organization/nodes').send({ nodeType: 'group', name: 'HasKids' })
    ).body.node.id as string;
    await http()
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'legal_company', name: 'Kid', parentId: rootId })
      .expect(201);

    await http().post(`/api/v1/organization/nodes/${rootId}/archive`).expect(409);
  });

  // --- B-2-4: read endpoints -----------------------------------------------

  async function makeChain(): Promise<{ group: string; company: string; branch: string }> {
    const group = (
      await http().post('/api/v1/organization/nodes').send({ nodeType: 'group', name: 'G' })
    ).body.node.id as string;
    const company = (
      await http()
        .post('/api/v1/organization/nodes')
        .send({ nodeType: 'legal_company', name: 'C', parentId: group })
    ).body.node.id as string;
    const branch = (
      await http()
        .post('/api/v1/organization/nodes')
        .send({ nodeType: 'branch', name: 'B', parentId: company })
    ).body.node.id as string;
    return { group, company, branch };
  }

  it('GET /nodes/:id returns the node, or 404, or 400 for a bad id', async () => {
    if (!dbAvailable) return;
    const { company } = await makeChain();

    const found = await http().get(`/api/v1/organization/nodes/${company}`).expect(200);
    expect(found.body.node.name).toBe('C');

    await http().get(`/api/v1/organization/nodes/${randomUUID()}`).expect(404);
    await http().get('/api/v1/organization/nodes/not-a-uuid').expect(400);
  });

  it('GET /nodes/:id/subtree returns the node nested with its descendants', async () => {
    if (!dbAvailable) return;
    const { company, branch } = await makeChain();

    const res = await http().get(`/api/v1/organization/nodes/${company}/subtree`).expect(200);
    expect(res.body.subtree.id).toBe(company);
    expect(res.body.subtree.children[0].id).toBe(branch);
  });

  it('GET /nodes/:id/ancestors returns the chain root-first', async () => {
    if (!dbAvailable) return;
    const { group, company, branch } = await makeChain();

    const res = await http().get(`/api/v1/organization/nodes/${branch}/ancestors`).expect(200);
    expect(res.body.node.id).toBe(branch);
    expect(res.body.ancestors.map((a: { id: string }) => a.id)).toEqual([group, company]);
  });

  it('GET /node-types returns the vocabulary with allowed parents', async () => {
    if (!dbAvailable) return;

    const res = await http().get('/api/v1/organization/node-types').expect(200);
    expect(res.body.nodeTypes).toHaveLength(13);

    const legalCompany = res.body.nodeTypes.find(
      (t: { code: string }) => t.code === 'legal_company',
    );
    expect(legalCompany.canBeRoot).toBe(true);
    expect(legalCompany.allowedParentTypes).toEqual(['group']);
  });
});
