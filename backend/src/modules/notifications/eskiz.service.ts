import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface EskizTokenResponse {
  data: {
    token: string;
  };
  status: string;
}

interface EskizSendResponse {
  id: string;
  status: string;
  message?: string;
}

/** Foydalanuvchiga ko'rinadi (ruschasi — `ERROR_CATALOGUE`). */
export const SMS_UNAVAILABLE_MESSAGE = "SMS xizmati vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko'ring.";

@Injectable()
export class EskizService {
  private readonly logger = new Logger(EskizService.name);
  private readonly apiUrl = 'https://notify.eskiz.uz/api';
  private readonly client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 10000,
    });
  }

  async sendSms(phone: string, message: string): Promise<void> {
    const email = this.configService.get<string>('ESKIZ_EMAIL', '');
    if (!email || email === 'your@email.com') {
      // ⚠️ Prod'da jim o'tkazib yuborish — foydalanuvchini aldash: "SMS
      // yuborildi" deydi, kod esa hech qachon kelmaydi. Dev'da kod jurnalda.
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        this.logger.error('ESKIZ_EMAIL is not set in production — OTP SMS cannot be sent');
        throw new ServiceUnavailableException(SMS_UNAVAILABLE_MESSAGE);
      }
      this.logger.warn(`[DEV] SMS skipped for ${phone}: ${message}`);
      return;
    }

    const formattedPhone = phone.replace('+', '');
    try {
      await this.postSms(await this.getToken(), formattedPhone, message, phone);
    } catch (err) {
      const error = err as { response?: { status?: number; data?: unknown }; message: string };
      if (error.response?.status !== 401) {
        this.logger.error(`SMS send failed: ${error.message}`, error.response?.data);
        throw new ServiceUnavailableException(SMS_UNAVAILABLE_MESSAGE);
      }
      // Token muddati tugagan — yangilab, BIR marta qayta urinamiz.
      this.token = null;
      this.tokenExpiresAt = null;
      try {
        await this.postSms(await this.getToken(), formattedPhone, message, phone);
      } catch (retryErr) {
        this.logger.error(`SMS send failed after token refresh: ${(retryErr as Error).message}`);
        throw new ServiceUnavailableException(SMS_UNAVAILABLE_MESSAGE);
      }
    }
  }

  private async postSms(token: string, mobilePhone: string, message: string, phone: string): Promise<void> {
    const response = await this.client.post<EskizSendResponse>(
      '/message/sms/send',
      {
        mobile_phone: mobilePhone,
        message,
        // ESKIZ_FROM is documented in every .env file but used to be ignored
        // in favour of this hardcoded value (the 401 retry still was), so
        // changing the approved sender id required a code change.
        from: this.configService.get<string>('ESKIZ_FROM') || '4546',
        callback_url: '',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    this.logger.log(`SMS sent to ${phone}, id: ${response.data.id}, status: ${response.data.status}`);
  }

  private async getToken(): Promise<string> {
    if (this.token && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.token;
    }

    const email = this.configService.get<string>('ESKIZ_EMAIL');
    const password = this.configService.get<string>('ESKIZ_PASSWORD');

    try {
      const response = await this.client.post<EskizTokenResponse>('/auth/login', {
        email,
        password,
      });

      this.token = response.data.data.token;
      // Token valid for 30 days, but refresh every 29 days
      this.tokenExpiresAt = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);

      this.logger.log('Eskiz token refreshed successfully');
      return this.token;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Eskiz authentication failed: ${error.message}`);
      throw new Error('SMS service authentication failed');
    }
  }
}
