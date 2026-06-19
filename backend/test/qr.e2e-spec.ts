import request from 'supertest';
import { initTestApp, createTestUser, TestContext, TestUser } from './setup';
import { INestApplication } from '@nestjs/common';

describe('QR Code E2E', () => {
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

  it('should return QR code data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/qr')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.dataUrl).toBeDefined();
    expect(res.body.dataUrl).toContain('data:image/png');
    expect(res.body.whatsappUrl).toBeDefined();
    expect(res.body.whatsappUrl).toContain('wa.me');
  });

  it('should download QR as SVG', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/qr/download?token=${user.token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('image/svg+xml');
  });
});
