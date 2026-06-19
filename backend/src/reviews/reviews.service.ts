import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AiService } from '../ai/ai.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    restaurantId: string,
    filters?: {
      source?: string;
      sort?: 'newest' | 'lowest';
      limit?: number;
      offset?: number;
    },
  ) {
    const where: { restaurantId: string; source?: string } = { restaurantId };

    if (filters?.source && filters.source !== 'all') {
      where.source = filters.source;
    }

    const orderBy =
      filters?.sort === 'lowest'
        ? { rating: 'asc' as const }
        : { postedAt: 'desc' as const };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        take: filters?.limit ?? 20,
        skip: filters?.offset ?? 0,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  async getStats(restaurantId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { restaurantId },
      select: { rating: true, source: true, sentiment: true },
    });

    const total = reviews.length;
    const avgRating =
      total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;

    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      rating: star,
      count: reviews.filter((r) => r.rating === star).length,
    }));

    const bySource = ['google', 'facebook', 'whatsapp'].map((source) => {
      const sourceReviews = reviews.filter((r) => r.source === source);
      return {
        source,
        count: sourceReviews.length,
        avgRating:
          sourceReviews.length > 0
            ? sourceReviews.reduce((sum, r) => sum + r.rating, 0) /
              sourceReviews.length
            : 0,
      };
    });

    const negativesThisMonth = reviews.filter(
      (r) => r.sentiment === 'negative',
    ).length;

    return {
      total,
      avgRating: Math.round(avgRating * 10) / 10,
      distribution,
      bySource,
      negativesIntercepted: negativesThisMonth,
    };
  }

  async reply(reviewId: string, restaurantId: string, replyText: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, restaurantId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        replied: true,
        replyText,
        repliedAt: new Date(),
      },
    });
  }

  async draftAiReply(reviewId: string, restaurantId: string, ai: AiService) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, restaurantId },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const result = await ai.draftReply({
      reviewText: review.text || '(No text)',
      reviewRating: review.rating,
      reviewLanguage: review.language,
      restaurantName: restaurant.name,
      voiceSetting: restaurant.voiceSetting,
      authorName: review.author,
    });

    return {
      reviewId: review.id,
      draftReply: result.reply,
      provider: result.provider,
    };
  }

  async analyzeSentiment(
    reviewId: string,
    restaurantId: string,
    ai: AiService,
  ) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, restaurantId },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const result = await ai.analyzeSentiment(review.text || '', review.rating);

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { sentiment: result.sentiment },
    });

    return {
      reviewId: review.id,
      sentiment: result.sentiment,
      confidence: result.confidence,
    };
  }

  async simulateSync(restaurantId: string) {
    const fakeReviews = [
      {
        source: 'google',
        author: 'New Google User',
        rating: 5,
        text: 'Just discovered this gem! Amazing food and great value.',
        language: 'en',
      },
      {
        source: 'google',
        author: 'Weekend Visitor',
        rating: 4,
        text: 'Nice atmosphere, food was tasty. Slightly long wait.',
        language: 'en',
      },
      {
        source: 'facebook',
        author: 'FB Foodie',
        rating: 5,
        text: 'Recommended by a friend and did not disappoint! The biryani is outstanding.',
        language: 'en',
      },
      {
        source: 'facebook',
        author: 'Local Reviewer',
        rating: 3,
        text: 'Decent food but nothing special. Service could be faster.',
        language: 'en',
      },
      {
        source: 'google',
        author: 'Naya Customer',
        rating: 4,
        text: 'Bahut accha khana! Paneer butter masala was the best.',
        language: 'hi',
      },
    ];

    const picked = fakeReviews[Math.floor(Math.random() * fakeReviews.length)];
    const externalId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const review = await this.prisma.review.create({
      data: {
        restaurantId,
        source: picked.source,
        externalId,
        author: picked.author,
        rating: picked.rating,
        text: picked.text,
        language: picked.language,
        sentiment:
          picked.rating >= 4
            ? 'positive'
            : picked.rating === 3
              ? 'neutral'
              : 'negative',
        postedAt: new Date(),
        replied: false,
      },
    });

    this.logger.log(
      `Simulated sync: new ${picked.source} review from "${picked.author}" (${picked.rating}★)`,
    );

    return {
      synced: 1,
      source: picked.source,
      review,
    };
  }
}
