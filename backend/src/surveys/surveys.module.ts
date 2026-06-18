import { Module } from '@nestjs/common';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';

@Module({
  imports: [WhatsAppModule],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
