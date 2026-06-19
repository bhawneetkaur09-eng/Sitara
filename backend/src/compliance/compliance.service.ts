import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConsentStats(restaurantId: string) {
    const total = await this.prisma.customer.count({
      where: { restaurantId },
    });
    const consented = await this.prisma.customer.count({
      where: { restaurantId, consentAt: { not: null } },
    });

    return {
      totalCustomers: total,
      consentedCustomers: consented,
      consentRate: total > 0 ? Math.round((consented / total) * 100) : 0,
    };
  }

  async purgeStaleData(restaurantId: string) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);

    const staleCustomers = await this.prisma.customer.findMany({
      where: {
        restaurantId,
        createdAt: { lt: cutoff },
      },
      select: { id: true, phone: true },
    });

    if (staleCustomers.length === 0) {
      return { purged: 0, message: 'No stale customer data to purge.' };
    }

    const ids = staleCustomers.map((c) => c.id);

    await this.prisma.survey.deleteMany({
      where: { customerId: { in: ids } },
    });

    await this.prisma.customer.deleteMany({
      where: { id: { in: ids } },
    });

    this.logger.log(
      `DPDP purge: removed ${staleCustomers.length} customers inactive for 12+ months`,
    );

    return {
      purged: staleCustomers.length,
      message: `Purged ${staleCustomers.length} customer records inactive for 12+ months (DPDP Act compliance).`,
    };
  }

  async exportCustomerData(restaurantId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { restaurantId },
      include: {
        surveys: {
          select: {
            id: true,
            rating: true,
            feedback: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return customers.map((c) => ({
      phone: c.phone,
      name: c.name,
      consentAt: c.consentAt,
      createdAt: c.createdAt,
      surveyCount: c.surveys.length,
      surveys: c.surveys,
    }));
  }
}
