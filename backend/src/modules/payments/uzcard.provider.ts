import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';
import { IPaymentProvider, PaymentInitiateResult } from './payment.interface';

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

  async initiate(
    amount: number,
    orderId: string,
    phone: string,
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
    const terminalId = this.configService.get<string>('UZCARD_TERMINAL_ID', '');

    if (!terminalId) {
      // Fail closed: never treat an unconfigured provider as a verified payment.
      this.logger.error(
        `UZCARD_TERMINAL_ID not set — rejecting verify for ${transactionId}`,
      );
      return false;
    }

    try {
      const response = await axios.get<{ status: string }>(
        `${this.apiUrl}/status/${transactionId}`,
        {
          headers: {
            'X-Api-Key': this.configService.get<string>('UZCARD_API_KEY', ''),
          },
        },
      );

      return response.data.status === 'PAID';
    } catch (err) {
      this.logger.error(
        `Uzcard verify failed for ${transactionId}: ${(err as Error).message}`,
      );
      return false;
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

    if (!sign) {
      return false;
    }

    const data = `${body['terminal_id']}&${body['order_id']}&${body['amount']}`;
    const expected = createHmac('sha256', secretKey).update(data).digest('hex');

    // Constant-time compare so the expected signature cannot be recovered
    // byte by byte from response timing.
    return timingSafeCompare(sign, expected);
  }
}
