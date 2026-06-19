import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export interface TestUser {
  token: string;
  restaurantId: string;
}

export async function initTestApp(): Promise<TestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.init();

  const prisma = app.get(PrismaService);

  await prisma.alert.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.review.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  return { app, prisma };
}

export async function createTestUser(
  app: INestApplication,
): Promise<TestUser> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      name: 'Test Owner',
      email: `test-${Date.now()}@sitara.in`,
      password: 'test1234',
      restaurantName: 'Test Kitchen',
      restaurantLocation: 'HSR Layout, Bangalore',
    })
    .expect(201);

  return {
    token: res.body.access_token,
    restaurantId: res.body.user.restaurant.id,
  };
}
