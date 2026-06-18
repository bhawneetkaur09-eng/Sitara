import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async findAll(restaurantId: string, status?: string) {
    const where: any = { restaurantId };
    if (status) {
      where.status = status;
    }

    return this.prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { survey: true },
    });
  }

  async getOpenCount(restaurantId: string) {
    return this.prisma.alert.count({
      where: { restaurantId, status: 'open' },
    });
  }

  async resolve(
    alertId: string,
    restaurantId: string,
    resolveNote: string,
    sendReviewNudge: boolean = false,
  ) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, restaurantId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolveNote,
        resolvedAt: new Date(),
      },
    });

    if (sendReviewNudge && alert.customerPhone) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: restaurantId },
      });

      if (restaurant) {
        const googleLink = restaurant.googlePlaceId
          ? `https://search.google.com/local/writereview?placeid=${restaurant.googlePlaceId}`
          : 'https://g.page/review';

        await this.whatsapp.sendTextMessage(
          alert.customerPhone,
          `Hi from ${restaurant.name}! We hope we were able to make things right. 🙏\n\nIf you're happy with how we resolved your concern, we'd really appreciate a review:\n${googleLink}\n\nThank you for giving us another chance!`,
        );

        this.logger.log(
          `Recovery nudge sent to ${alert.customerPhone} after resolving alert ${alertId}`,
        );
      }
    }

    return updated;
  }
}
