import request from 'supertest';
import { initTestApp, TestContext } from './setup';
import { INestApplication } from '@nestjs/common';

describe('Auth Protection E2E', () => {
  let app: INestApplication;
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await initTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  const protectedRoutes = [
    { method: 'get', path: '/api/reviews' },
    { method: 'get', path: '/api/reviews/stats' },
    { method: 'get', path: '/api/surveys' },
    { method: 'get', path: '/api/alerts' },
    { method: 'get', path: '/api/billing' },
    { method: 'get', path: '/api/billing/plans' },
    { method: 'get', path: '/api/billing/features' },
    { method: 'get', path: '/api/compliance/consent-stats' },
    { method: 'get', path: '/api/restaurant/settings' },
    { method: 'get', path: '/api/restaurant/locations' },
    { method: 'get', path: '/api/qr' },
  ];

  protectedRoutes.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path} — should return 401`, async () => {
      await (request(app.getHttpServer()) as any)[method](path).expect(401);
    });
  });
});
