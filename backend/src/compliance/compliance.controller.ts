import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ComplianceService } from './compliance.service';

@Controller('api/compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('consent-stats')
  async consentStats(@CurrentUser() user: any) {
    return this.compliance.getConsentStats(user.restaurantId);
  }

  @Post('purge-stale')
  async purgeStale(@CurrentUser() user: any) {
    return this.compliance.purgeStaleData(user.restaurantId);
  }

  @Get('export')
  async exportData(@CurrentUser() user: any) {
    return this.compliance.exportCustomerData(user.restaurantId);
  }
}
