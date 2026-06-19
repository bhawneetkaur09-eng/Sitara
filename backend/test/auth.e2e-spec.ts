import request from 'supertest';
import { initTestApp, TestContext } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Auth E2E', () => {
  let app: INestApplication;
  let ctx: TestContext;

  let ownerToken: string;
  let restaurantId: string;

  beforeAll(async () => {
    ctx = await initTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── REGISTRATION ───────────────────────────────────────────────

  describe('Registration', () => {
    it('should create a new account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test Owner',
          email: 'test@sitara.in',
          password: 'test1234',
          restaurantName: 'Test Kitchen',
          restaurantLocation: 'HSR Layout, Bangalore',
        })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.email).toBe('test@sitara.in');
      expect(res.body.user.name).toBe('Test Owner');
      expect(res.body.user.role).toBe('owner');
      expect(res.body.user.restaurant.name).toBe('Test Kitchen');

      ownerToken = res.body.access_token;
      restaurantId = res.body.user.restaurant.id;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Duplicate',
          email: 'test@sitara.in',
          password: 'test1234',
          restaurantName: 'Dup Place',
          restaurantLocation: 'Somewhere',
        })
        .expect(400);

      expect(res.body.message).toContain('already exists');
    });
  });

  // ─── LOGIN ──────────────────────────────────────────────────────

  describe('Login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@sitara.in', password: 'test1234' })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.email).toBe('test@sitara.in');
      ownerToken = res.body.access_token;
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@sitara.in', password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@sitara.in', password: 'test1234' })
        .expect(401);
    });

    it('GET /api/auth/me — should return current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.email).toBe('test@sitara.in');
      expect(res.body.restaurantId).toBe(restaurantId);
    });

    it('GET /api/auth/me — should reject without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });

});
