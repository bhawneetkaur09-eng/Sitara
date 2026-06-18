import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const users = await this.prisma.user.findMany({
      where: { email: user.email },
      include: {
        restaurant: {
          select: { id: true, name: true, location: true, plan: true },
        },
      },
    });

    return users.map((u) => u.restaurant);
  }

  async switchLocation(userId: string, restaurantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const targetUser = await this.prisma.user.findFirst({
      where: { email: user.email, restaurantId },
    });
    if (!targetUser) {
      throw new BadRequestException('You do not have access to this restaurant');
    }

    return this.authService.loginAsUser(targetUser.id);
  }

  async addLocation(userId: string, data: { name: string; location: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const restaurant = await this.prisma.restaurant.create({
      data: { name: data.name, location: data.location },
    });

    await this.prisma.user.create({
      data: {
        email: user.email,
        password: user.password,
        name: user.name,
        role: user.role,
        restaurantId: restaurant.id,
      },
    });

    return restaurant;
  }

  async getSettings(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    return {
      gatingEnabled: restaurant.gatingEnabled,
      recoveryOffer: restaurant.recoveryOffer,
      googlePlaceId: restaurant.googlePlaceId,
      whatsappNumber: restaurant.whatsappNumber,
      voiceSetting: restaurant.voiceSetting,
    };
  }

  async updateSettings(
    restaurantId: string,
    data: {
      gatingEnabled?: boolean;
      recoveryOffer?: string | null;
      googlePlaceId?: string | null;
      voiceSetting?: string;
    },
  ) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data,
    });
  }
}
