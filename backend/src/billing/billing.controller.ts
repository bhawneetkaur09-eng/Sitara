import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';

@Controller('api/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  getPlans() {
    return this.billing.getPlans();
  }

  @Get()
  async getBilling(@CurrentUser() user: any) {
    return this.billing.getBillingInfo(user.restaurantId);
  }

  @Get('features')
  async getFeatures(@CurrentUser() user: any) {
    return this.billing.getFeatures(user.restaurantId);
  }

  @Post('change-plan')
  async changePlan(
    @CurrentUser() user: any,
    @Body('plan') plan: string,
  ) {
    return this.billing.changePlan(user.restaurantId, plan);
  }
}
