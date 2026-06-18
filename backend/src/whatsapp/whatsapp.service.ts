import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendTemplatePayload {
  to: string;
  templateName: string;
  restaurantName: string;
}

export interface WhatsAppMessage {
  from: string;
  type: string;
  text?: string;
  button?: { text: string; payload: string };
  timestamp: number;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly isSimulated: boolean;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    this.isSimulated = !token;

    if (this.isSimulated) {
      this.logger.warn(
        'No WHATSAPP_TOKEN found — running in simulated mode. Messages will be logged but not sent.',
      );
    }
  }

  async sendSurveyTemplate(payload: SendTemplatePayload): Promise<{ messageId: string; simulated: boolean }> {
    if (this.isSimulated) {
      const messageId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.logger.log(
        `[SIMULATED] Survey sent to ${payload.to} for "${payload.restaurantName}" — messageId: ${messageId}`,
      );
      return { messageId, simulated: true };
    }

    return this.sendViaMetaCloudApi(payload);
  }

  async sendTextMessage(to: string, text: string): Promise<{ messageId: string; simulated: boolean }> {
    if (this.isSimulated) {
      const messageId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.logger.log(`[SIMULATED] Text message to ${to}: "${text}" — messageId: ${messageId}`);
      return { messageId, simulated: true };
    }

    return this.sendTextViaMetaCloudApi(to, text);
  }

  parseWebhookPayload(body: any): WhatsAppMessage | null {
    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      if (!message) return null;

      const parsed: WhatsAppMessage = {
        from: message.from,
        type: message.type,
        timestamp: parseInt(message.timestamp, 10),
      };

      if (message.type === 'text') {
        parsed.text = message.text?.body;
      } else if (message.type === 'interactive' || message.type === 'button') {
        const reply = message.interactive?.button_reply || message.button?.reply;
        if (reply) {
          parsed.button = { text: reply.title, payload: reply.id };
        }
      }

      return parsed;
    } catch {
      this.logger.warn('Failed to parse webhook payload');
      return null;
    }
  }

  verifyWebhookToken(token: string): boolean {
    const verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN') || 'sitara-dev-verify';
    return token === verifyToken;
  }

  private async sendViaMetaCloudApi(payload: SendTemplatePayload): Promise<{ messageId: string; simulated: boolean }> {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: payload.to,
          type: 'template',
          template: {
            name: payload.templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: payload.restaurantName }],
              },
            ],
          },
        }),
      },
    );

    const data = await response.json();
    return { messageId: data.messages?.[0]?.id || 'unknown', simulated: false };
  }

  private async sendTextViaMetaCloudApi(to: string, text: string): Promise<{ messageId: string; simulated: boolean }> {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      },
    );

    const data = await response.json();
    return { messageId: data.messages?.[0]?.id || 'unknown', simulated: false };
  }
}
