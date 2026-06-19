import request from 'supertest';
import { initTestApp, createTestUser, TestContext, TestUser } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Alerts E2E', () => {
  let app: INestApplication;
  let ctx: TestContext;
  let user: TestUser;
  let alertId: string;

  beforeAll(async () => {
    ctx = await initTestApp();
    app = ctx.app;
    user = await createTestUser(app);

    // Create a low-rated survey to generate an alert
    const sendRes = await request(app.getHttpServer())
      .post('/api/surveys/send')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+919876543211', customerName: 'Unhappy Customer' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/surveys/${sendRes.body.surveyId}/simulate-rating`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ rating: 1, feedback: 'Terrible food' })
      .expect(201);

    const alertsRes = await request(app.getHttpServer())
      .get('/api/alerts')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    alertId = alertsRes.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should list alerts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/alerts')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should return open alert count', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/alerts/count')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(typeof res.body.count).toBe('number');
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it('should resolve an alert', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/alerts/${alertId}/resolve`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ resolveNote: 'Spoke with customer, offered discount' })
      .expect(201);

    expect(res.body.status).toBe('resolved');
    expect(res.body.resolveNote).toBe(
      'Spoke with customer, offered discount',
    );
    expect(res.body.resolvedAt).toBeDefined();
  });

  it('should resolve with recovery nudge', async () => {
    // Create another low-rated survey → alert
    const sendRes = await request(app.getHttpServer())
      .post('/api/surveys/send')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+919876543222', customerName: 'Nudge Test' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/surveys/${sendRes.body.surveyId}/simulate-rating`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ rating: 2, feedback: 'Slow service' })
      .expect(201);

    const alertsRes = await request(app.getHttpServer())
      .get('/api/alerts')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    const openAlert = alertsRes.body.find((a: any) => a.status === 'open');
    expect(openAlert).toBeDefined();

    const res = await request(app.getHttpServer())
      .post(`/api/alerts/${openAlert.id}/resolve`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ resolveNote: 'Fixed', sendReviewNudge: true })
      .expect(201);

    expect(res.body.status).toBe('resolved');
  });
});
