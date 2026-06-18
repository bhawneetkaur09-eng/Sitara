import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  async getQrDataUrl(restaurantId: string): Promise<{
    dataUrl: string;
    whatsappUrl: string;
    restaurantName: string;
  }> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    const whatsappNumber = restaurant.whatsappNumber || '919592319964';
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hi`;

    const dataUrl = await QRCode.toDataURL(whatsappUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });

    return {
      dataUrl,
      whatsappUrl,
      restaurantName: restaurant.name,
    };
  }

  async getQrSvg(restaurantId: string): Promise<string> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    const whatsappNumber = restaurant.whatsappNumber || '919592319964';
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hi`;

    return QRCode.toString(whatsappUrl, {
      type: 'svg',
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'H',
    });
  }
}
