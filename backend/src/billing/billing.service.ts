import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_FEATURES, PLAN_LIMITS } from './plan-features';

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 499,
    priceAnnual: 4990,
    features: [
      'WhatsApp surveys',
      'Basic dashboard',
      'Google reviews',
      'Up to 100 surveys/month',
      '1 location',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 999,
    priceAnnual: 9990,
    features: [
      'Everything in Starter',
      'AI reply drafting',
      'Sentiment analysis',
      'Facebook reviews',
      'Up to 500 surveys/month',
      'Review gating',
      '3 locations',
    ],
    popular: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 1999,
    priceAnnual: 19990,
    features: [
      'Everything in Growth',
      'Unlimited surveys',
      'Unlimited locations',
      'Priority support',
      'Custom branding',
      'Advanced analytics',
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  getPlans() {
    return Object.values(PLANS);
  }

  async getBillingInfo(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new BadRequestException('Restaurant not found');
    }

    const plan = PLANS[restaurant.plan as PlanId] || PLANS.starter;

    const surveyCount = await this.prisma.survey.count({
      where: { restaurantId },
    });

    const locationCount = await this.prisma.restaurant.count({
      where: {
        users: { some: { restaurantId } },
      },
    });

    return {
      currentPlan: plan,
      usage: {
        surveysThisMonth: surveyCount,
        locations: locationCount || 1,
      },
      billingCycle: 'monthly',
      nextBillingDate: this.getNextBillingDate(),
      paymentMethod: null,
    };
  }

  async changePlan(restaurantId: string, newPlan: string) {
    if (!PLANS[newPlan as PlanId]) {
      throw new BadRequestException(
        `Invalid plan: ${newPlan}. Must be starter, growth, or pro.`,
      );
    }

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new BadRequestException('Restaurant not found');
    }

    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { plan: newPlan },
    });

    this.logger.log(
      `Restaurant ${restaurant.name} changed plan: ${restaurant.plan} → ${newPlan}`,
    );

    return {
      previousPlan: restaurant.plan,
      newPlan: newPlan,
      plan: PLANS[newPlan as PlanId],
      message: `Plan changed to ${PLANS[newPlan as PlanId].name}. In production, Razorpay subscription would be updated.`,
    };
  }

  async getFeatures(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) throw new BadRequestException('Restaurant not found');

    const plan = restaurant.plan || 'starter';
    const features = PLAN_FEATURES[plan] || PLAN_FEATURES.starter;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

    return {
      plan,
      features: Array.from(features),
      limits,
    };
  }

  private getNextBillingDate(): string {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    return next.toISOString().split('T')[0];
  }
}
