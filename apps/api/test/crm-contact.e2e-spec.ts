import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { runMigrations } from '../src/core/database/migrator';
import { canConnect, dropAllSchemas } from './db-helpers';

/** Plan item 26: contacts / addresses linked to parties, with one primary per party. */
const DATABASE_URL = process.env.DATABASE_URL ?? '';

describe('CRM contacts and addresses (e2e)', () => {
  let dbAvailable = false;
  let app: INestApplication;
  let pool: Pool;
  let customerId = '';
  let supplierId = '';

  beforeAll(async () => {
    dbAvailable = await canConnect(DATABASE_URL);
    if (!dbAvailable) {
      console.warn('[26] SKIPPED contacts e2e: no reachable PostgreSQL at DATABASE_URL.');
      return;
    }
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    await dropAllSchemas(pool);
    await runMigrations({
      databaseUrl: DATABASE_URL,
      migrationsSchema: 'crm_contact_e2e_bookkeeping',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const http = request(app.getHttpServer());
    const org = await http
      .post('/api/v1/organization/nodes')
      .send({ nodeType: 'legal_company', name: 'Contacts Co' })
      .expect(201);
    const orgNodeId = (org.body.node ?? org.body).id as string;
    customerId = (
      await request(app.getHttpServer())
        .post('/api/v1/crm/customers')
        .send({ code: 'C1', name: 'Nile Hospital', orgNodeId })
        .expect(201)
    ).body.customer.id;
    supplierId = (
      await request(app.getHttpServer())
        .post('/api/v1/crm/suppliers')
        .send({ code: 'S1', name: 'Delta Steel', orgNodeId })
        .expect(201)
    ).body.supplier.id;
  }, 60000);

  afterAll(async () => {
    if (!dbAvailable) return;
    await app.close();
    await dropAllSchemas(pool);
    await pool.end();
  });

  it('links one contact to two parties and keeps one primary per party', async () => {
    if (!dbAvailable) return;
    const http = (): request.Agent => request(app.getHttpServer()) as unknown as request.Agent;
    const first = await http()
      .post('/api/v1/crm/contacts')
      .send({
        firstName: 'Karim',
        email: 'Karim@Example.com',
        links: [
          { partyType: 'customer', partyId: customerId, isPrimary: true },
          { partyType: 'supplier', partyId: supplierId },
        ],
      })
      .expect(201);
    expect(first.body.contact.email).toBe('karim@example.com');
    expect(first.body.contact.links).toHaveLength(2);

    const second = await http()
      .post('/api/v1/crm/contacts')
      .send({
        firstName: 'Salma',
        links: [{ partyType: 'customer', partyId: customerId, isPrimary: true }],
      })
      .expect(201);

    const details = await http()
      .get(`/api/v1/crm/parties/customer/${customerId}/contact-details`)
      .expect(200);
    expect(details.body.primaryContactId).toBe(second.body.contact.id);
    expect(details.body.contacts.map((c: { firstName: string }) => c.firstName)).toEqual([
      'Salma',
      'Karim',
    ]);

    const supplierContacts = await http()
      .get(`/api/v1/crm/contacts?partyType=supplier&partyId=${supplierId}`)
      .expect(200);
    expect(supplierContacts.body.contacts).toHaveLength(1);
  });

  it('stores an address and rejects bad input', async () => {
    if (!dbAvailable) return;
    const http = (): request.Agent => request(app.getHttpServer()) as unknown as request.Agent;
    const addr = await http()
      .post('/api/v1/crm/addresses')
      .send({
        title: 'Head office',
        line1: '12 Tahrir St',
        city: 'Cairo',
        links: [{ partyType: 'customer', partyId: customerId, isPrimary: true }],
      })
      .expect(201);
    expect(addr.body.address.country).toBe('Egypt');
    await http().post('/api/v1/crm/contacts').send({ firstName: 'x', email: 'nope' }).expect(400);
    await http()
      .post('/api/v1/crm/addresses')
      .send({ title: 't', line1: 'l', city: 'c', addressType: 'moon' })
      .expect(400);
    await http()
      .post('/api/v1/crm/contacts')
      .send({
        firstName: 'x',
        links: [{ partyType: 'customer', partyId: '5f0c6f3e-8a51-4a4e-9a57-6d6d8f1b2c3d' }],
      })
      .expect(404);
  });
});
