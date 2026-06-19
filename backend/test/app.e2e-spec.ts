import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Sitara E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let restaurantId: string;
  let reviewId: string;
  let surveyId: string;
  let alertId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.alert.deleteMany();
    await prisma.survey.deleteMany();
    await prisma.review.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    await prisma.restaurant.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── AUTH: REGISTER ─────────────────────────────────────────────

  describe('Auth — Registration', () => {
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

  // ─── AUTH: LOGIN ────────────────────────────────────────────────

  describe('Auth — Login', () => {
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

  // ─── REVIEWS ────────────────────────────────────────────────────

  describe('Reviews', () => {
    beforeAll(async () => {
      const reviews = [
        { source: 'google', author: 'Alice', rating: 5, text: 'Amazing food!', language: 'en', sentiment: 'positive' },
        { source: 'google', author: 'Bob', rating: 2, text: 'Cold food', language: 'en', sentiment: 'negative' },
        { source: 'facebook', author: 'Charlie', rating: 4, text: 'Nice place', language: 'en', sentiment: 'positive' },
        { source: 'whatsapp', author: '+91 99999', rating: 5, text: null, language: 'en', sentiment: 'positive' },
        { source: 'whatsapp', author: '+91 88888', rating: 1, text: 'Bad service', language: 'en', sentiment: 'negative' },
      ];

      for (const r of reviews) {
        await prisma.review.create({
          data: {
            restaurantId,
            source: r.source,
            externalId: `test_${Math.random().toString(36).slice(2)}`,
            author: r.author,
            rating: r.rating,
            text: r.text,
            language: r.language,
            sentiment: r.sentiment,
            postedAt: new Date(),
          },
        });
      }
    });

    it('should list all reviews', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reviews')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.reviews).toHaveLength(5);
      expect(res.body.total).toBe(5);
      reviewId = res.body.reviews[0].id;
    });

    it('should filter by source=google', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reviews?source=google')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.reviews).toHaveLength(2);
      res.body.reviews.forEach((r: any) => expect(r.source).toBe('google'));
    });

    it('should filter by source=facebook', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reviews?source=facebook')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0].author).toBe('Charlie');
    });

    it('should filter by source=whatsapp', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reviews?source=whatsapp')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.reviews).toHaveLength(2);
    });

    it('should sort by lowest rating', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reviews?sort=lowest')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const ratings = res.body.reviews.map((r: any) => r.rating);
      expect(ratings[0]).toBeLessThanOrEqual(ratings[ratings.length - 1]);
    });

    it('should return dashboard stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reviews/stats')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.total).toBe(5);
      expect(typeof res.body.avgRating).toBe('number');
      expect(res.body.avgRating).toBeGreaterThan(0);
      expect(res.body.bySource).toBeDefined();
      expect(res.body.distribution).toBeDefined();
    });

    it('should reply to a review', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ replyText: 'Thank you for your feedback!' })
        .expect(201);

      expect(res.body.replied).toBe(true);
      expect(res.body.replyText).toBe('Thank you for your feedback!');
      expect(res.body.repliedAt).toBeDefined();
    });

    it('should draft an AI reply', async () => {
      const unreplied = await prisma.review.findFirst({
        where: { restaurantId, replied: false },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/reviews/${unreplied!.id}/draft-reply`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.draftReply).toBeDefined();
      expect(typeof res.body.draftReply).toBe('string');
      expect(res.body.draftReply.length).toBeGreaterThan(0);
      expect(res.body.provider).toBeDefined();
    });

    it('should simulate new review sync', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reviews/sync')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.synced).toBe(1);
      expect(res.body.source).toBeDefined();
      expect(res.body.review).toBeDefined();
      expect(res.body.review.id).toBeDefined();
    });

    it('should reject without auth', async () => {
      await request(app.getHttpServer()).get('/api/reviews').expect(401);
    });
  });

  // ─── SURVEYS ────────────────────────────────────────────────────

  describe('Surveys', () => {
    it('should send a survey', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/surveys/send')
        .set('Authorization', `Bearer ${ownerToken}`)
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
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ customerName: 'No Phone' })
        .expect(400);
    });

    it('should rate a survey (happy path)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/surveys/${surveyId}/simulate-rating`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ rating: 5, feedback: 'Loved it!' })
        .expect(201);

      expect(res.body.rating).toBe(5);
    });

    it('should create an alert on low rating', async () => {
      // Send a new survey
      const sendRes = await request(app.getHttpServer())
        .post('/api/surveys/send')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ phone: '+919876543211', customerName: 'Unhappy Customer' })
        .expect(201);

      // Rate it poorly
      await request(app.getHttpServer())
        .post(`/api/surveys/${sendRes.body.surveyId}/simulate-rating`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ rating: 1, feedback: 'Terrible food' })
        .expect(201);

      // Check that an alert was created
      const alertsRes = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const matchingAlert = alertsRes.body.find(
        (a: any) => a.rating === 1 && a.reason === 'Terrible food',
      );
      expect(matchingAlert).toBeDefined();
      alertId = matchingAlert.id;
    });

    it('should list surveys', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/surveys')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.surveys).toBeDefined();
      expect(Array.isArray(res.body.surveys)).toBe(true);
      expect(res.body.surveys.length).toBeGreaterThanOrEqual(2);
    });

    it('should return survey stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/surveys/stats')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.responded).toBeGreaterThanOrEqual(2);
      expect(typeof res.body.avgRating).toBe('number');
    });

    it('should handle QR scan simulation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/surveys/simulate-scan')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ phone: '+919876543299' })
        .expect(201);

      expect(res.body.surveyId).toBeDefined();
      expect(res.body.status).toBe('sent');
    });
  });

  // ─── ALERTS ─────────────────────────────────────────────────────

  describe('Alerts', () => {
    it('should list alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should return open alert count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/alerts/count')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(typeof res.body.count).toBe('number');
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it('should resolve an alert', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/alerts/${alertId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolveNote: 'Spoke with customer, offered discount' })
        .expect(201);

      expect(res.body.status).toBe('resolved');
      expect(res.body.resolveNote).toBe('Spoke with customer, offered discount');
      expect(res.body.resolvedAt).toBeDefined();
    });

    it('should resolve with recovery nudge', async () => {
      // Create another low-rated survey → alert
      const sendRes = await request(app.getHttpServer())
        .post('/api/surveys/send')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ phone: '+919876543222', customerName: 'Nudge Test' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/surveys/${sendRes.body.surveyId}/simulate-rating`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ rating: 2, feedback: 'Slow service' })
        .expect(201);

      const alertsRes = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const openAlert = alertsRes.body.find(
        (a: any) => a.status === 'open',
      );
      expect(openAlert).toBeDefined();

      const res = await request(app.getHttpServer())
        .post(`/api/alerts/${openAlert.id}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolveNote: 'Fixed', sendReviewNudge: true })
        .expect(201);

      expect(res.body.status).toBe('resolved');
    });
  });

  // ─── BILLING ────────────────────────────────────────────────────

  describe('Billing', () => {
    it('should return 3 plan tiers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/billing/plans')
        .set('Authorization', `Bearer ${ownerToken}`)
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
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.currentPlan).toBeDefined();
      expect(res.body.currentPlan.id).toBe('starter');
      expect(res.body.usage).toBeDefined();
      expect(res.body.nextBillingDate).toBeDefined();
    });

    it('should upgrade to growth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'growth' })
        .expect(201);

      expect(res.body.previousPlan).toBe('starter');
      expect(res.body.newPlan).toBe('growth');
      expect(res.body.message).toContain('Growth');
    });

    it('should reject invalid plan name', async () => {
      await request(app.getHttpServer())
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'enterprise' })
        .expect(400);
    });

    it('should return features for growth plan', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/billing/features')
        .set('Authorization', `Bearer ${ownerToken}`)
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
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'starter' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/billing/features')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.plan).toBe('starter');
      expect(res.body.features).not.toContain('ai_reply');
      expect(res.body.features).not.toContain('facebook_reviews');
      expect(res.body.limits.surveysPerMonth).toBe(100);
      expect(res.body.limits.locations).toBe(1);
    });
  });

  // ─── RESTAURANT SETTINGS ───────────────────────────────────────

  describe('Restaurant Settings', () => {
    it('should return settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/restaurant/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(typeof res.body.gatingEnabled).toBe('boolean');
      expect(res.body.voiceSetting).toBeDefined();
    });

    it('should update gating and recovery offer', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/restaurant/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ gatingEnabled: true, recoveryOffer: '15% off next visit' })
        .expect(200);

      expect(res.body.gatingEnabled).toBe(true);
      expect(res.body.recoveryOffer).toBe('15% off next visit');
    });

    it('should update voice setting', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/restaurant/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ voiceSetting: 'formal' })
        .expect(200);

      expect(res.body.voiceSetting).toBe('formal');
    });
  });

  // ─── MULTI-LOCATION ────────────────────────────────────────────

  describe('Multi-Location', () => {
    it('should list 1 location initially', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/restaurant/locations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Test Kitchen');
    });

    it('should add a new location', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/restaurant/add-location')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Test Kitchen', location: 'Indiranagar, Bangalore' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.location).toBe('Indiranagar, Bangalore');
    });

    it('should now show 2 locations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/restaurant/locations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.length).toBe(2);
    });

    it('should switch location and return new token', async () => {
      const locsRes = await request(app.getHttpServer())
        .get('/api/restaurant/locations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const otherLoc = locsRes.body.find((l: any) => l.id !== restaurantId);

      const res = await request(app.getHttpServer())
        .post(`/api/restaurant/switch/${otherLoc.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.restaurant.location).toBe('Indiranagar, Bangalore');

      // Switch back
      await request(app.getHttpServer())
        .post(`/api/restaurant/switch/${restaurantId}`)
        .set('Authorization', `Bearer ${res.body.access_token}`)
        .expect(201);
    });

    it('should reject switch to invalid location', async () => {
      await request(app.getHttpServer())
        .post('/api/restaurant/switch/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });
  });

  // ─── COMPLIANCE ─────────────────────────────────────────────────

  describe('Compliance (DPDP)', () => {
    it('should return consent stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/compliance/consent-stats')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(typeof res.body.totalCustomers).toBe('number');
      expect(typeof res.body.consentedCustomers).toBe('number');
      expect(typeof res.body.consentRate).toBe('number');
    });

    it('should export customer data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/compliance/export')
        .set('Authorization', `Bearer ${ownerToken}`)
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
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.purged).toBe(0);
      expect(res.body.message).toContain('No stale');
    });
  });

  // ─── QR CODE ────────────────────────────────────────────────────

  describe('QR Code', () => {
    it('should return QR code data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/qr')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.dataUrl).toBeDefined();
      expect(res.body.dataUrl).toContain('data:image/png');
      expect(res.body.whatsappUrl).toBeDefined();
      expect(res.body.whatsappUrl).toContain('wa.me');
    });

    it('should download QR as SVG', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/qr/download?token=${ownerToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('image/svg+xml');
    });
  });

  // ─── AUTH PROTECTION ────────────────────────────────────────────

  describe('Auth Protection — all routes require token', () => {
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
});
