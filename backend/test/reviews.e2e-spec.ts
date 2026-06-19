import request from 'supertest';
import { initTestApp, createTestUser, TestContext, TestUser } from './setup';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Reviews E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: TestContext;
  let user: TestUser;
  let reviewId: string;

  beforeAll(async () => {
    ctx = await initTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    user = await createTestUser(app);

    const reviews = [
      {
        source: 'google',
        author: 'Alice',
        rating: 5,
        text: 'Amazing food!',
        language: 'en',
        sentiment: 'positive',
      },
      {
        source: 'google',
        author: 'Bob',
        rating: 2,
        text: 'Cold food',
        language: 'en',
        sentiment: 'negative',
      },
      {
        source: 'facebook',
        author: 'Charlie',
        rating: 4,
        text: 'Nice place',
        language: 'en',
        sentiment: 'positive',
      },
      {
        source: 'whatsapp',
        author: '+91 99999',
        rating: 5,
        text: null,
        language: 'en',
        sentiment: 'positive',
      },
      {
        source: 'whatsapp',
        author: '+91 88888',
        rating: 1,
        text: 'Bad service',
        language: 'en',
        sentiment: 'negative',
      },
    ];

    for (const r of reviews) {
      await prisma.review.create({
        data: {
          restaurantId: user.restaurantId,
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

  afterAll(async () => {
    await app.close();
  });

  it('should list all reviews', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reviews')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.reviews).toHaveLength(5);
    expect(res.body.total).toBe(5);
    reviewId = res.body.reviews[0].id;
  });

  it('should filter by source=google', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reviews?source=google')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.reviews).toHaveLength(2);
    res.body.reviews.forEach((r: any) => expect(r.source).toBe('google'));
  });

  it('should filter by source=facebook', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reviews?source=facebook')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].author).toBe('Charlie');
  });

  it('should filter by source=whatsapp', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reviews?source=whatsapp')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.reviews).toHaveLength(2);
  });

  it('should sort by lowest rating', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reviews?sort=lowest')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    const ratings = res.body.reviews.map((r: any) => r.rating);
    expect(ratings[0]).toBeLessThanOrEqual(ratings[ratings.length - 1]);
  });

  it('should return dashboard stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reviews/stats')
      .set('Authorization', `Bearer ${user.token}`)
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
      .set('Authorization', `Bearer ${user.token}`)
      .send({ replyText: 'Thank you for your feedback!' })
      .expect(201);

    expect(res.body.replied).toBe(true);
    expect(res.body.replyText).toBe('Thank you for your feedback!');
    expect(res.body.repliedAt).toBeDefined();
  });

  it('should draft an AI reply', async () => {
    const unreplied = await prisma.review.findFirst({
      where: { restaurantId: user.restaurantId, replied: false },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/reviews/${unreplied!.id}/draft-reply`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    expect(res.body.draftReply).toBeDefined();
    expect(typeof res.body.draftReply).toBe('string');
    expect(res.body.draftReply.length).toBeGreaterThan(0);
    expect(res.body.provider).toBeDefined();
  });

  it('should simulate new review sync', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reviews/sync')
      .set('Authorization', `Bearer ${user.token}`)
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
