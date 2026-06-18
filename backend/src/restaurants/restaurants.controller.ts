import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RestaurantsService } from './restaurants.service';

@Controller('api/restaurant')
@UseGuards(JwtAuthGuard)
export class RestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Get('locations')
  async listLocations(@CurrentUser() user: any) {
    return this.restaurants.listForUser(user.id);
  }

  @Post('switch/:id')
  async switchLocation(
    @CurrentUser() user: any,
    @Param('id') restaurantId: string,
  ) {
    return this.restaurants.switchLocation(user.id, restaurantId);
  }

  @Post('add-location')
  async addLocation(
    @CurrentUser() user: any,
    @Body() body: { name: string; location: string },
  ) {
    return this.restaurants.addLocation(user.id, body);
  }

  @Get('settings')
  async getSettings(@CurrentUser() user: any) {
    return this.restaurants.getSettings(user.restaurantId);
  }

  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: any,
    @Body()
    body: {
      gatingEnabled?: boolean;
      recoveryOffer?: string | null;
      googlePlaceId?: string | null;
      voiceSetting?: string;
    },
  ) {
    return this.restaurants.updateSettings(user.restaurantId, body);
  }
}
