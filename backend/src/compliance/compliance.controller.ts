import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ComplianceService } from './compliance.service';

@Controller('api/compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('consent-stats')
  async consentStats(@CurrentUser() user: AuthenticatedUser) {
    return this.compliance.getConsentStats(user.restaurantId);
  }

  @Post('purge-stale')
  async purgeStale(@CurrentUser() user: AuthenticatedUser) {
    return this.compliance.purgeStaleData(user.restaurantId);
  }

  @Get('export')
  async exportData(@CurrentUser() user: AuthenticatedUser) {
    return this.compliance.exportCustomerData(user.restaurantId);
  }
}
