import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AlertsModule } from './alerts/alerts.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { SurveysModule } from './surveys/surveys.module';
import { QrModule } from './qr/qr.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { AiModule } from './ai/ai.module';
import { BillingModule } from './billing/billing.module';
import { ComplianceModule } from './compliance/compliance.module';
// Phase 7: Billing, Compliance, Multi-Location

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ReviewsModule,
    AlertsModule,
    WhatsAppModule,
    SurveysModule,
    QrModule,
    RestaurantsModule,
    AiModule,
    BillingModule,
    ComplianceModule,
  ],
})
export class AppModule {}
