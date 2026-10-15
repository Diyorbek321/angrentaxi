import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';
import { IPaymentProvider, PaymentInitiateOptions, PaymentInitiateResult } from './payment.interface';

/**
 * Constant-time string comparison for secrets/signatures.
 * timingSafeEqual() throws on differing buffer lengths, so compare lengths
 * first rather than letting it raise.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class UzcardProvider implements IPaymentProvider {
  private readonly logger = new Logger(UzcardProvider.name);
  private readonly apiUrl = 'https://api.uzcard.uz/payment';

  constructor(private readonly configService: ConfigService) {}

  /** Terminal va imzo kaliti bormi (dev mock hisobga olinmaydi). */
  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('UZCARD_TERMINAL_ID', '') &&
        this.configService.get<string>('UZCARD_SECRET_KEY', ''),
    );
  }

  async initiate(
    amount: number,
    orderId: string,
    phone: string,
    options: PaymentInitiateOptions = {},
  ): Promise<PaymentInitiateResult> {
    const terminalId = this.configService.get<string>('UZCARD_TERMINAL_ID', '');

    if (!terminalId) {
      // Dev mode: return a mock redirect URL without hitting the real API
      this.logger.warn(
        `UZCARD_TERMINAL_ID not set — using dev mock for order ${orderId}`,
      );
      return {
        url: `https://uzcard.uz/pay?order=${orderId}&amount=${amount}`,
        id: `uzcard_dev_${orderId}`,
        provider: 'uzcard',
      };
    }

    // UZPS integration: POST to terminal, get redirect URL.
    // UZPS requires: terminal_id, amount (in tiyin = UZS * 100), order_id, return_url.
    const response = await axios.post<{ redirect_url: string; transaction_id: string }>(
      `${this.apiUrl}/create`,
      {
        terminal_id: terminalId,
        amount: Math.round(amount * 100), // convert to tiyin
        order_id: orderId,
        phone: phone.replace('+', ''),
        return_url:
          options.returnUrl ??
          this.configService.get<string>('APP_URL', 'http://localhost:3000') +
            '/api/v1/payments/uzcard/callback',
      },
      {
        headers: {
          'X-Api-Key': this.configService.get<string>('UZCARD_API_KEY', ''),
        },
      },
    );

    this.logger.log(
      `Uzcard checkout initiated for order ${orderId}, amount: ${amount} UZS`,
    );

    return {
      url: response.data.redirect_url,
      id: response.data.transaction_id,
      provider: 'uzcard',
    };
  }

  async verify(transactionId: string): Promise<boolean> {
    return (await this.fetchStatus(transactionId)) === 'PAID';
  }

  /**
   * UZPS status API'si (`GET /payment/status/<id>`) — provayder tomonidagi
   * HAQIQIY holat. Callback imzosi `status` ni qamramaydi (faqat
   * terminal_id&order_id&amount), shu sabab pulga ta'sir qiladigan har bir
   * o'tish (PAID → kirim, to'langandan keyin CANCELLED → teskari) shu bilan
   * tasdiqlanadi (security review #7). Xato/sozlanmagan — `null` (fail closed).
   */
  async fetchStatus(transactionId: string): Promise<string | null> {
    const terminalId = this.configService.get<string>('UZCARD_TERMINAL_ID', '');

    if (!terminalId || !transactionId) {
      // Fail closed: never treat an unconfigured provider as a verified payment.
      this.logger.error(`UZCARD_TERMINAL_ID not set — rejecting status check for ${transactionId}`);
      return null;
    }

    try {
      const response = await axios.get<{ status: string }>(
        `${this.apiUrl}/status/${encodeURIComponent(transactionId)}`,
        {
          headers: {
            'X-Api-Key': this.configService.get<string>('UZCARD_API_KEY', ''),
          },
        },
      );
      return typeof response.data?.status === 'string' ? response.data.status : null;
    } catch (err) {
      this.logger.error(`Uzcard status check failed for ${transactionId}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Verifies the HMAC-SHA256 signature sent with UZPS callbacks.
   * Fails closed: if no secret key is configured, the callback is rejected
   * rather than trusted, so a missing env var can never be mistaken for a
   * verified payment.
   */
  verifyCallback(body: Record<string, unknown>): boolean {
    const secretKey = this.configService.get<string>('UZCARD_SECRET_KEY', '');

    if (!secretKey) {
      this.logger.error(
        'UZCARD_SECRET_KEY not set — rejecting callback verification',
      );
      return false;
    }

    const sign = body['sign'] as string | undefined;

    if (!sign || typeof sign !== 'string') {
      return false;
    }

    // Imzo terminal_id ni qamraydi, lekin kalit boshqa terminal bilan umumiy
    // bo'lishi mumkin — callback FAQAT bizning terminalimizdan (#7).
    const terminalId = this.configService.get<string>('UZCARD_TERMINAL_ID', '');
    const callbackTerminal = body['terminal_id'];
    if (
      !terminalId ||
      (typeof callbackTerminal !== 'string' && typeof callbackTerminal !== 'number') ||
      String(callbackTerminal) !== terminalId
    ) {
      this.logger.warn('Uzcard callback rejected: terminal_id does not match UZCARD_TERMINAL_ID');
      return false;
    }

    const data = `${body['terminal_id']}&${body['order_id']}&${body['amount']}`;
    const expected = createHmac('sha256', secretKey).update(data).digest('hex');

    // Constant-time compare so the expected signature cannot be recovered
    // byte by byte from response timing.
    return timingSafeCompare(sign, expected);
  }
}
