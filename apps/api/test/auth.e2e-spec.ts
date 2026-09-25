import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { runMigrations } from '../src/core/database/migrator';
import { canConnect, dropAllSchemas } from './db-helpers';

/**
 * Plan item 5.3: login is enforced by default. Without a token every business route answers 401;
 * the bootstrap administrator from AUTH_BOOTSTRAP_USERNAME/PASSWORD can log in and then call them.
 */
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const BOOKKEEPING_SCHEMA = 'auth_e2e_bookkeeping';

describe('Enforced login (e2e)', () => {
  let dbAvailable = false;
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    dbAvailable = await canConnect(DATABASE_URL);
    if (!dbAvailable) {
      console.warn('[5.3] SKIPPED auth e2e: no reachable PostgreSQL at DATABASE_URL.');
      return;
    }
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    await dropAllSchemas(pool);
    await runMigrations({ databaseUrl: DATABASE_URL, migrationsSchema: BOOKKEEPING_SCHEMA });

    // The environment is read when the app module is loaded, so it is imported after setting it.
    process.env.AUTH_ENFORCE = 'true';
    process.env.AUTH_BOOTSTRAP_USERNAME = 'admin';
    process.env.AUTH_BOOTSTRAP_PASSWORD = 'first-login-123';
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60000);

  afterAll(async () => {
    if (!dbAvailable) return;
    await app.close();
    await dropAllSchemas(pool);
    await pool.end();
  });

  it('rejects a business route without a token, keeps health public', async () => {
    if (!dbAvailable) return;
    await request(app.getHttpServer()).get('/api/v1/organization/tree').expect(401);
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('logs in with the bootstrap administrator and then answers', async () => {
    if (!dbAvailable) return;
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });
    expect([400, 401]).toContain(wrong.status);
    expect(wrong.body.accessToken).toBeUndefined();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'first-login-123' })
      .expect(200);
    const token = login.body.accessToken as string;
    expect(token).toBeTruthy();
    await request(app.getHttpServer())
      .get('/api/v1/organization/tree')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.user.id).toBe(login.body.user.id);
    expect(login.body.user.username).toBe('admin');
  });

  it('rejects a forged token', async () => {
    if (!dbAvailable) return;
    await request(app.getHttpServer())
      .get('/api/v1/organization/tree')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});
