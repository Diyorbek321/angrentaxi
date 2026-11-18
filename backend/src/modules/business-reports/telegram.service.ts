import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/** Telegram `sendMessage` chegarasi (4096) — HTML teglar uchun zaxira bilan. */
export const TELEGRAM_MAX_LENGTH = 4000;

/**
 * Egasiga biznes hisobotlarini yuboradi. Server alertlari (deploy/oracle/lib.sh)
 * bilan bir xil `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`.
 *
 * Hech qachon xato otmaydi: hisobot yuborilmasligi biznes jarayonini
 * to'xtatmasligi kerak — natija `false` bo'ladi va jurnalga yoziladi.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({ baseURL: 'https://api.telegram.org', timeout: 10000 });
  }

  isConfigured(): boolean {
    return Boolean(this.token() && this.chatId());
  }

  async send(html: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — report not sent');
      return false;
    }
    try {
      for (const chunk of splitMessage(html)) {
        await this.client.post(`/bot${this.token()}/sendMessage`, {
          chat_id: this.chatId(),
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Telegram send failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private token(): string {
    return this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  private chatId(): string {
    return this.configService.get<string>('TELEGRAM_CHAT_ID', '');
  }
}

/** Qatorlar bo'yicha bo'ladi — HTML teg qator o'rtasida uzilmasin. */
function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > TELEGRAM_MAX_LENGTH && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
