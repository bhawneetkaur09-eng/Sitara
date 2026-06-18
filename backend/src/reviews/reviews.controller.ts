import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AiService } from '../ai/ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly ai: AiService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('source') source?: string,
    @Query('sort') sort?: 'newest' | 'lowest',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reviewsService.findAll(user.restaurantId, {
      source,
      sort,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    return this.reviewsService.getStats(user.restaurantId);
  }

  @Post(':id/reply')
  async reply(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('replyText') replyText: string,
  ) {
    return this.reviewsService.reply(id, user.restaurantId, replyText);
  }

  @Post(':id/draft-reply')
  async draftReply(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.reviewsService.draftAiReply(id, user.restaurantId, this.ai);
  }

  @Post(':id/analyze-sentiment')
  async analyzeSentiment(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.reviewsService.analyzeSentiment(id, user.restaurantId, this.ai);
  }

  @Post('sync')
  async syncReviews(@CurrentUser() user: any) {
    return this.reviewsService.simulateSync(user.restaurantId);
  }
}
