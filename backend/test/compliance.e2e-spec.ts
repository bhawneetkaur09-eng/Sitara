import request from 'supertest';
import { initTestApp, createTestUser, TestContext, TestUser } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Compliance E2E', () => {
  let app: INestApplication;
  let ctx: TestContext;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await initTestApp();
    app = ctx.app;
    user = await createTestUser(app);

    // Create some customer data via surveys
    await request(app.getHttpServer())
      .post('/api/surveys/send')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+919876543210', customerName: 'Compliance Test' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return consent stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/compliance/consent-stats')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(typeof res.body.totalCustomers).toBe('number');
    expect(typeof res.body.consentedCustomers).toBe('number');
    expect(typeof res.body.consentRate).toBe('number');
  });

  it('should export customer data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/compliance/export')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0].phone).toBeDefined();
      expect(res.body[0].surveys).toBeDefined();
    }
  });

  it('should run purge (0 stale in test)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/compliance/purge-stale')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    expect(res.body.purged).toBe(0);
    expect(res.body.message).toContain('No stale');
  });
});
