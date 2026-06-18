import { Controller, Get, UseGuards, Res, Header } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { QrService } from './qr.service';

@Controller('api/qr')
@UseGuards(JwtAuthGuard)
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get()
  async getQr(@CurrentUser() user: any) {
    return this.qrService.getQrDataUrl(user.restaurantId);
  }

  @Get('download')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Content-Disposition', 'attachment; filename="sitara-feedback-qr.svg"')
  async downloadQr(@CurrentUser() user: any, @Res() res: Response) {
    const svg = await this.qrService.getQrSvg(user.restaurantId);
    res.send(svg);
  }
}
