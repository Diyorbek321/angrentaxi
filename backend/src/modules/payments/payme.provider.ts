import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import axios from 'axios';
import { IPaymentProvider, PaymentInitiateResult } from './payment.interface';

/**
 * Constant-time string comparison for secrets/signatures.
 * timingSafeEqual() throws when the two buffers differ in length, so the
 * length check has to happen first — a length mismatch is already a
 * mismatch and leaks nothing beyond the (public) length of the digest.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

interface PaymeOrderParams {
  m: string;      // merchant ID
  ac: {           // account fields
    order_id: string;
  };
  a: number;      // amount in tiyin (1 UZS = 100 tiyin)
  l: string;      // language
  c: string;      // callback URL
}

@Injectable()
export class PaymeProvider implements IPaymentProvider {
  private readonly logger = new Logger(PaymeProvider.name);
  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly apiUrl = 'https://checkout.paycom.uz';

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.get<string>('PAYME_MERCHANT_ID', '');
    this.secretKey = this.configService.get<string>('PAYME_SECRET_KEY', '');
  }

  async initiate(
    amount: number,
    orderId: string,
    _phone: string,
  ): Promise<PaymentInitiateResult> {
    // Amount must be in tiyin (cents), 1 UZS = 100 tiyin
    const amountTiyin = Math.round(amount * 100);

    const params: PaymeOrderParams = {
      m: this.merchantId,
      ac: { order_id: orderId },
      a: amountTiyin,
      l: 'ru',
      c: `${this.configService.get('APP_URL', 'http://localhost:3000')}/payments/payme/callback`,
    };

    const encodedParams = Buffer.from(JSON.stringify(params)).toString('base64');
    const checkoutUrl = `${this.apiUrl}/${encodedParams}`;

    this.logger.log(`Payme checkout initiated for order ${orderId}, amount: ${amount} UZS`);

    return {
      url: checkoutUrl,
      id: `payme_${orderId}_${Date.now()}`,
      provider: 'payme',
    };
  }

  async verify(transactionId: string): Promise<boolean> {
    try {
      const credentials = Buffer.from(
        `Paycom:${this.secretKey}`,
      ).toString('base64');

      const response = await axios.post(
        'https://checkout.paycom.uz/api',
        {
          method: 'receipts.get',
          params: { id: transactionId },
        },
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const receipt = (response.data as { result?: { receipt?: { state?: number } } })?.result?.receipt;
      // State 4 = paid
      return receipt?.state === 4;
    } catch (err) {
      this.logger.error(`Payme verify failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Verifies the HTTP Basic credentials Payme sends with every callback.
   *
   * Fails closed: when the merchant id or secret key is not configured, the
   * callback is rejected outright. Without this guard an unconfigured
   * deployment compares the caller-supplied password against an empty
   * string, so `Authorization: Basic base64("x:")` would authenticate as
   * Payme and let anyone mark orders paid.
   *
   * Comparisons are constant-time so the key cannot be recovered byte by
   * byte from response timing.
   */
  verifyCallbackSignature(body: Record<string, unknown>, authHeader: string): boolean {
    if (!this.merchantId || !this.secretKey) {
      this.logger.error(
        'PAYME_MERCHANT_ID / PAYME_SECRET_KEY not set — rejecting callback verification',
      );
      return false;
    }

    if (!authHeader) {
      return false;
    }

    try {
      const base64Credentials = authHeader.replace('Basic ', '');
      const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');

      // Split on the *first* colon only: the login is always "Paycom", but
      // the key itself may legitimately contain colons.
      const separatorIndex = decoded.indexOf(':');

      if (separatorIndex === -1) {
        return false;
      }

      const password = decoded.slice(separatorIndex + 1);

      if (!password) {
        return false;
      }

      const expectedHash = createHash('sha1')
        .update(`${this.merchantId}${this.secretKey}`)
        .digest('hex');

      return (
        timingSafeCompare(password, this.secretKey) ||
        timingSafeCompare(password, expectedHash)
      );
    } catch {
      return false;
    }
  }
}
