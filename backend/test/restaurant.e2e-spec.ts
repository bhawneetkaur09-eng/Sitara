import request from 'supertest';
import { initTestApp, createTestUser, TestContext, TestUser } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Restaurant E2E', () => {
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

  // ─── SETTINGS ───────────────────────────────────────────────────

  describe('Settings', () => {
    it('should return settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/restaurant/settings')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(typeof res.body.gatingEnabled).toBe('boolean');
      expect(res.body.voiceSetting).toBeDefined();
    });

    it('should update gating and recovery offer', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/restaurant/settings')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ gatingEnabled: true, recoveryOffer: '15% off next visit' })
        .expect(200);

      expect(res.body.gatingEnabled).toBe(true);
      expect(res.body.recoveryOffer).toBe('15% off next visit');
    });

    it('should update voice setting', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/restaurant/settings')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ voiceSetting: 'formal' })
        .expect(200);

      expect(res.body.voiceSetting).toBe('formal');
    });
  });

  // ─── MULTI-LOCATION ─────────────────────────────────────────────

  describe('Multi-Location', () => {
    it('should list 1 location initially', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/restaurant/locations')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Test Kitchen');
    });

    it('should add a new location', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/restaurant/add-location')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ name: 'Test Kitchen', location: 'Indiranagar, Bangalore' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.location).toBe('Indiranagar, Bangalore');
    });

    it('should now show 2 locations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/restaurant/locations')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(res.body.length).toBe(2);
    });

    it('should switch location and return new token', async () => {
      const locsRes = await request(app.getHttpServer())
        .get('/api/restaurant/locations')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      const otherLoc = locsRes.body.find(
        (l: any) => l.id !== user.restaurantId,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/restaurant/switch/${otherLoc.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.restaurant.location).toBe(
        'Indiranagar, Bangalore',
      );

      // Switch back
      await request(app.getHttpServer())
        .post(`/api/restaurant/switch/${user.restaurantId}`)
        .set('Authorization', `Bearer ${res.body.access_token}`)
        .expect(201);
    });

    it('should reject switch to invalid location', async () => {
      await request(app.getHttpServer())
        .post('/api/restaurant/switch/nonexistent-id')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(400);
    });
  });
});
