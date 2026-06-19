import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async sendSurvey(
    restaurantId: string,
    phone: string,
    customerName?: string,
    channel: string = 'manual',
  ) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new BadRequestException('Restaurant not found');
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSurvey = await this.prisma.survey.findFirst({
      where: {
        restaurantId,
        customer: { phone },
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentSurvey) {
      throw new BadRequestException(
        'A survey was already sent to this number in the last 24 hours',
      );
    }

    const customer = await this.prisma.customer.upsert({
      where: {
        restaurantId_phone: { restaurantId, phone },
      },
      create: {
        restaurantId,
        phone,
        name: customerName || null,
        consentAt: new Date(),
      },
      update: {
        name: customerName || undefined,
      },
    });

    const result = await this.whatsapp.sendSurveyTemplate({
      to: phone,
      templateName: 'sitara_survey_v1',
      restaurantName: restaurant.name,
    });

    const survey = await this.prisma.survey.create({
      data: {
        restaurantId,
        customerId: customer.id,
        channel,
        status: 'sent',
      },
    });

    this.logger.log(
      `Survey ${survey.id} sent to ${phone} for ${restaurant.name} (${result.simulated ? 'simulated' : 'live'})`,
    );

    return {
      surveyId: survey.id,
      messageId: result.messageId,
      simulated: result.simulated,
      phone,
      status: 'sent',
    };
  }

  async handleQrScan(phone: string, restaurantId?: string) {
    // When a customer scans the QR and sends "Hi", auto-send them a survey.
    // If restaurantId isn't provided (real webhook), find the restaurant by whatsapp number.
    const restaurant = restaurantId
      ? await this.prisma.restaurant.findUnique({
          where: { id: restaurantId },
        })
      : await this.prisma.restaurant.findFirst();

    if (!restaurant) {
      throw new BadRequestException('No restaurant found');
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    this.logger.log(
      `QR scan detected from ${normalizedPhone} for ${restaurant.name}`,
    );

    return this.sendSurvey(restaurant.id, normalizedPhone, undefined, 'qr');
  }

  async handleRating(surveyId: string, rating: number, feedback?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: { restaurant: true, customer: true },
    });
    if (!survey) {
      throw new BadRequestException('Survey not found');
    }
    if (survey.rating !== null) {
      throw new BadRequestException('Survey already rated');
    }

    const isHappy = rating >= 4;
    const gatingEnabled = survey.restaurant.gatingEnabled;

    let newStatus = 'rated';
    if (gatingEnabled) {
      newStatus = isHappy ? 'routed_public' : 'routed_private';
    }

    const updated = await this.prisma.survey.update({
      where: { id: surveyId },
      data: {
        rating,
        feedback: feedback || null,
        status: newStatus,
      },
      include: { customer: true, restaurant: true },
    });

    await this.prisma.review.create({
      data: {
        restaurantId: survey.restaurantId,
        source: 'whatsapp',
        externalId: `wa_survey_${surveyId}`,
        author: survey.customer.name || survey.customer.phone,
        rating,
        text: feedback || null,
        language: 'en',
        sentiment: isHappy ? 'positive' : rating === 3 ? 'neutral' : 'negative',
        postedAt: new Date(),
        replied: false,
      },
    });

    if (isHappy && gatingEnabled) {
      // Happy path: nudge to leave a public Google review
      const googlePlaceId = survey.restaurant.googlePlaceId;
      const googleLink = googlePlaceId
        ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
        : 'https://g.page/review';

      await this.whatsapp.sendTextMessage(
        survey.customer.phone,
        `So glad you enjoyed your visit to ${survey.restaurant.name}! 🌟\n\nWould you mind sharing your experience on Google? It really helps us:\n${googleLink}`,
      );

      this.logger.log(
        `Survey ${surveyId}: happy path — Google review link sent to ${survey.customer.phone}`,
      );
    } else if (!isHappy) {
      // Unhappy path: create alert + send recovery message
      await this.prisma.alert.create({
        data: {
          restaurantId: survey.restaurantId,
          surveyId: survey.id,
          rating,
          reason: feedback || null,
          customerPhone: survey.customer.phone,
          status: 'open',
        },
      });

      if (!feedback) {
        await this.whatsapp.sendTextMessage(
          survey.customer.phone,
          `We're sorry to hear that your experience at ${survey.restaurant.name} wasn't great. What went wrong?\n\n• Food quality\n• Slow service\n• Cleanliness\n• Pricing\n• Other\n\nPlease reply and we'll make it right.`,
        );
      }

      // Send recovery offer if configured
      const recoveryOffer = survey.restaurant.recoveryOffer;
      if (recoveryOffer) {
        await this.whatsapp.sendTextMessage(
          survey.customer.phone,
          `Thank you for your feedback. We're truly sorry about your experience. Here's a gesture from us: ${recoveryOffer}\n\nWe hope to serve you better next time! 🙏`,
        );
        this.logger.log(
          `Survey ${surveyId}: recovery offer sent to ${survey.customer.phone}`,
        );
      }

      this.logger.log(
        `Survey ${surveyId}: unhappy path — alert created, reason prompt sent to ${survey.customer.phone}`,
      );
    }

    this.logger.log(
      `Survey ${surveyId} rated ${rating}/5 by ${survey.customer.phone} → ${newStatus}`,
    );

    return updated;
  }

  async findAll(
    restaurantId: string,
    filters?: { status?: string; limit?: number; offset?: number },
  ) {
    const where: { restaurantId: string; status?: string } = { restaurantId };
    if (filters?.status) {
      where.status = filters.status;
    }

    const [surveys, total] = await Promise.all([
      this.prisma.survey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 20,
        skip: filters?.offset ?? 0,
        include: { customer: true },
      }),
      this.prisma.survey.count({ where }),
    ]);

    return { surveys, total };
  }

  async getStats(restaurantId: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const allSurveys = await this.prisma.survey.findMany({
      where: { restaurantId },
      select: { rating: true, status: true, createdAt: true },
    });

    const sentToday = allSurveys.filter(
      (s) => s.createdAt >= todayStart,
    ).length;
    const sentThisWeek = allSurveys.filter(
      (s) => s.createdAt >= weekStart,
    ).length;
    const sentThisMonth = allSurveys.filter(
      (s) => s.createdAt >= monthStart,
    ).length;

    const rated = allSurveys.filter((s) => s.rating !== null);
    const responseRate =
      allSurveys.length > 0
        ? Math.round((rated.length / allSurveys.length) * 100)
        : 0;

    const avgRating =
      rated.length > 0
        ? Math.round(
            (rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) /
              rated.length) *
              10,
          ) / 10
        : 0;

    return {
      total: allSurveys.length,
      sentToday,
      sentThisWeek,
      sentThisMonth,
      responded: rated.length,
      responseRate,
      avgRating,
    };
  }
}
