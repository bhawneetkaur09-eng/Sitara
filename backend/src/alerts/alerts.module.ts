import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsAppModule],
  providers: [AlertsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
