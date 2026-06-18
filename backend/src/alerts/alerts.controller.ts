import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.alertsService.findAll(user.restaurantId, status);
  }

  @Get('count')
  async getOpenCount(@CurrentUser() user: any) {
    return { count: await this.alertsService.getOpenCount(user.restaurantId) };
  }

  @Post(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { resolveNote: string; sendReviewNudge?: boolean },
  ) {
    return this.alertsService.resolve(
      id,
      user.restaurantId,
      body.resolveNote,
      body.sendReviewNudge ?? false,
    );
  }
}
