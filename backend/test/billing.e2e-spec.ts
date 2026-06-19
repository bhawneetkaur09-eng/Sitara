import request from 'supertest';
import { initTestApp, createTestUser, TestContext, TestUser } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Billing E2E', () => {
  let app: INestApplication;
  let ctx: TestContext;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await initTestApp();
    app = ctx.app;
    user = await createTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 3 plan tiers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body).toHaveLength(3);
    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain('starter');
    expect(ids).toContain('growth');
    expect(ids).toContain('pro');
  });

  it('should return current billing info', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/billing')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.currentPlan).toBeDefined();
    expect(res.body.currentPlan.id).toBe('starter');
    expect(res.body.usage).toBeDefined();
    expect(res.body.nextBillingDate).toBeDefined();
  });

  it('should upgrade to growth', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/change-plan')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ plan: 'growth' })
      .expect(201);

    expect(res.body.previousPlan).toBe('starter');
    expect(res.body.newPlan).toBe('growth');
    expect(res.body.message).toContain('Growth');
  });

  it('should reject invalid plan name', async () => {
    await request(app.getHttpServer())
      .post('/api/billing/change-plan')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ plan: 'enterprise' })
      .expect(400);
  });

  it('should return features for growth plan', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/billing/features')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.plan).toBe('growth');
    expect(res.body.features).toContain('ai_reply');
    expect(res.body.features).toContain('facebook_reviews');
    expect(res.body.features).toContain('review_gating');
    expect(res.body.limits.surveysPerMonth).toBe(500);
  });

  it('should lose features on downgrade to starter', async () => {
    await request(app.getHttpServer())
      .post('/api/billing/change-plan')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ plan: 'starter' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/billing/features')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.plan).toBe('starter');
    expect(res.body.features).not.toContain('ai_reply');
    expect(res.body.features).not.toContain('facebook_reviews');
    expect(res.body.limits.surveysPerMonth).toBe(100);
    expect(res.body.limits.locations).toBe(1);
  });
});
