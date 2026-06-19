import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { SurveysService } from './surveys.service';
import {
  WhatsAppService,
  type WebhookBody,
} from '../whatsapp/whatsapp.service';
import { SendSurveyDto } from './dto/send-survey.dto';

@Controller('api')
export class SurveysController {
  constructor(
    private readonly surveys: SurveysService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Post('surveys/send')
  @UseGuards(JwtAuthGuard)
  async sendSurvey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendSurveyDto,
  ) {
    return this.surveys.sendSurvey(
      user.restaurantId,
      dto.phone,
      dto.customerName,
      dto.channel || 'manual',
    );
  }

  @Post('surveys/:id/simulate-rating')
  @UseGuards(JwtAuthGuard)
  async simulateRating(
    @Param('id') id: string,
    @Body() body: { rating: number; feedback?: string },
  ) {
    return this.surveys.handleRating(id, body.rating, body.feedback);
  }

  @Get('surveys')
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.surveys.findAll(user.restaurantId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('surveys/stats')
  @UseGuards(JwtAuthGuard)
  async stats(@CurrentUser() user: AuthenticatedUser) {
    return this.surveys.getStats(user.restaurantId);
  }

  // --- WhatsApp webhook endpoints (public, no auth) ---

  @Get('webhooks/whatsapp')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && this.whatsapp.verifyWebhookToken(token)) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  @Post('webhooks/whatsapp')
  async receiveWebhook(@Body() body: WebhookBody, @Res() res: Response) {
    res.status(200).send('EVENT_RECEIVED');

    const message = this.whatsapp.parseWebhookPayload(body);
    if (!message) return;

    // Handle star-rating button taps
    if (message.button) {
      const ratingMatch = message.button.payload.match(/^rating_(\d)_(.+)$/);
      if (!ratingMatch) return;

      const rating = parseInt(ratingMatch[1], 10);
      const surveyId = ratingMatch[2];

      try {
        await this.surveys.handleRating(surveyId, rating);
      } catch {
        // Already rated or invalid — ignore silently for webhook
      }
      return;
    }

    // Handle inbound "Hi" from QR scan — auto-send survey
    if (
      message.type === 'text' &&
      message.text?.toLowerCase().trim() === 'hi'
    ) {
      try {
        await this.surveys.handleQrScan(message.from);
      } catch {
        // Rate-limited or error — ignore silently
      }
    }
  }

  @Post('surveys/simulate-scan')
  @UseGuards(JwtAuthGuard)
  async simulateScan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { phone: string },
  ) {
    return this.surveys.handleQrScan(body.phone, user.restaurantId);
  }
}
