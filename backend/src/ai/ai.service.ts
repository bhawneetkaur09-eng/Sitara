import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiDraftRequest {
  reviewText: string;
  reviewRating: number;
  reviewLanguage: string;
  restaurantName: string;
  voiceSetting: string;
  authorName: string;
}

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: 'gemini' | 'simulated';
  private readonly geminiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.geminiKey = this.config.get<string>('GEMINI_API_KEY');
    this.provider = this.geminiKey ? 'gemini' : 'simulated';

    if (this.provider === 'simulated') {
      this.logger.warn(
        'No GEMINI_API_KEY found — running AI in simulated mode with template-based replies.',
      );
    } else {
      this.logger.log('AI service using Google Gemini.');
    }
  }

  async draftReply(
    req: AiDraftRequest,
  ): Promise<{ reply: string; provider: string }> {
    if (this.provider === 'gemini') {
      return this.draftWithGemini(req);
    }
    return this.draftSimulated(req);
  }

  async analyzeSentiment(
    text: string,
    rating: number,
  ): Promise<SentimentResult> {
    if (this.provider === 'gemini') {
      return this.sentimentWithGemini(text, rating);
    }
    return this.sentimentSimulated(text, rating);
  }

  private draftSimulated(req: AiDraftRequest): {
    reply: string;
    provider: string;
  } {
    const isHindi = req.reviewLanguage === 'hi';
    const name = req.authorName.split(' ')[0];

    if (req.reviewRating >= 4) {
      const reply = isHindi
        ? `${name} ji, ${req.restaurantName} mein aapka swagat hai! Aapki tarif sunkar bahut khushi hui. Hum aapko dobara seva karne ke liye tatpar hain. 🙏`
        : `Thank you so much, ${name}! We're thrilled to hear you enjoyed your experience at ${req.restaurantName}. Your kind words mean the world to our team. We look forward to welcoming you back soon!`;
      return { reply, provider: 'simulated' };
    }

    if (req.reviewRating === 3) {
      const reply = isHindi
        ? `${name} ji, ${req.restaurantName} mein aane ke liye dhanyavaad. Aapki raay humein behtar banane mein madad karegi. Hum aapke anubhav ko sudharne ka poora prayas karenge.`
        : `Thank you for your feedback, ${name}. We appreciate you taking the time to share your experience at ${req.restaurantName}. We're always working to improve and would love the chance to exceed your expectations next time.`;
      return { reply, provider: 'simulated' };
    }

    const reply = isHindi
      ? `${name} ji, ${req.restaurantName} mein aapko aisi taklif hui, iske liye hum kshama chahte hain. Aapki shikayat humne not kar li hai aur hum isme sudhar karenge. Kripya humse +91-XXXX seedhe sampark karein.`
      : `We sincerely apologize for your experience, ${name}. This is not the standard we hold ourselves to at ${req.restaurantName}. We've noted your concerns and are taking immediate steps to address them. Please reach out to us directly so we can make this right.`;
    return { reply, provider: 'simulated' };
  }

  private sentimentSimulated(_text: string, rating: number): SentimentResult {
    if (rating >= 4) return { sentiment: 'positive', confidence: 0.9 };
    if (rating === 3) return { sentiment: 'neutral', confidence: 0.7 };
    return { sentiment: 'negative', confidence: 0.9 };
  }

  private async draftWithGemini(
    req: AiDraftRequest,
  ): Promise<{ reply: string; provider: string }> {
    const prompt = `You are a restaurant reply assistant for "${req.restaurantName}".

Write a reply to this customer review. Match the tone: ${req.voiceSetting}.
Match the language of the review (if Hindi, reply in Hindi; if English, reply in English; if Hinglish, reply in Hinglish).
Keep it concise (2-3 sentences), genuine, and professional. Never be defensive.
Address the customer by first name if possible.

Customer: ${req.authorName}
Rating: ${req.reviewRating}/5
Review: "${req.reviewText}"

Reply:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
          }),
        },
      );

      const data = (await response.json()) as GeminiResponse;
      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        this.draftSimulated(req).reply;

      return { reply, provider: 'gemini' };
    } catch (err) {
      this.logger.error('Gemini API failed, falling back to simulated:', err);
      return this.draftSimulated(req);
    }
  }

  private async sentimentWithGemini(
    text: string,
    rating: number,
  ): Promise<SentimentResult> {
    const prompt = `Analyze the sentiment of this restaurant review. Reply with ONLY one word: positive, neutral, or negative.

Rating: ${rating}/5
Review: "${text}"

Sentiment:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 10, temperature: 0 },
          }),
        },
      );

      const data = (await response.json()) as GeminiResponse;
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text
        ?.trim()
        .toLowerCase();

      const validSentiments = ['positive', 'neutral', 'negative'] as const;
      if (
        result &&
        validSentiments.includes(result as (typeof validSentiments)[number])
      ) {
        return {
          sentiment: result as SentimentResult['sentiment'],
          confidence: 0.85,
        };
      }
    } catch (err) {
      this.logger.error(
        'Gemini sentiment failed, falling back to simulated:',
        err,
      );
    }

    return this.sentimentSimulated(text, rating);
  }
}
