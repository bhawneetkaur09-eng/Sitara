import request from 'supertest';
import { initTestApp, createTestUser, TestContext, TestUser } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Surveys E2E', () => {
  let app: INestApplication;
  let ctx: TestContext;
  let user: TestUser;
  let surveyId: string;

  beforeAll(async () => {
    ctx = await initTestApp();
    app = ctx.app;
    user = await createTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should send a survey', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/surveys/send')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+919876543210', customerName: 'Survey Test' })
      .expect(201);

    expect(res.body.surveyId).toBeDefined();
    expect(res.body.status).toBe('sent');
    expect(res.body.phone).toBe('+919876543210');
    surveyId = res.body.surveyId;
  });

  it('should reject without phone', async () => {
    await request(app.getHttpServer())
      .post('/api/surveys/send')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ customerName: 'No Phone' })
      .expect(400);
  });

  it('should rate a survey (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/surveys/${surveyId}/simulate-rating`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ rating: 5, feedback: 'Loved it!' })
      .expect(201);

    expect(res.body.rating).toBe(5);
  });

  it('should create an alert on low rating', async () => {
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

    const matchingAlert = alertsRes.body.find(
      (a: any) => a.rating === 1 && a.reason === 'Terrible food',
    );
    expect(matchingAlert).toBeDefined();
  });

  it('should list surveys', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/surveys')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.surveys).toBeDefined();
    expect(Array.isArray(res.body.surveys)).toBe(true);
    expect(res.body.surveys.length).toBeGreaterThanOrEqual(2);
  });

  it('should return survey stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/surveys/stats')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.responded).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.avgRating).toBe('number');
  });

  it('should handle QR scan simulation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/surveys/simulate-scan')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+919876543299' })
      .expect(201);

    expect(res.body.surveyId).toBeDefined();
    expect(res.body.status).toBe('sent');
  });
});
