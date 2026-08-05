import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
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
export class ClickProvider implements IPaymentProvider {
  private readonly logger = new Logger(ClickProvider.name);
  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly serviceId: string;
  private readonly checkoutUrl = 'https://my.click.uz/services/pay';

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.get<string>('CLICK_MERCHANT_ID', '');
    this.secretKey = this.configService.get<string>('CLICK_SECRET_KEY', '');
    this.serviceId = this.configService.get<string>('CLICK_SERVICE_ID', '');
  }

  async initiate(
    amount: number,
    orderId: string,
    phone: string,
  ): Promise<PaymentInitiateResult> {
    const params = new URLSearchParams({
      service_id: this.serviceId,
      merchant_id: this.merchantId,
      amount: amount.toString(),
      transaction_param: orderId,
      return_url: `${this.configService.get('APP_URL', 'http://localhost:3000')}/payments/click/return`,
      card_type: 'uzcard',
    });

    const checkoutUrl = `${this.checkoutUrl}?${params.toString()}`;

    this.logger.log(`Click checkout initiated for order ${orderId}, amount: ${amount} UZS`);

    return {
      url: checkoutUrl,
      id: `click_${orderId}_${Date.now()}`,
      provider: 'click',
    };
  }

  async verify(transactionId: string): Promise<boolean> {
    // Click doesn't have a direct verification endpoint in the same way
    // Verification happens via callback
    this.logger.log(`Click transaction ${transactionId} verification requested`);
    return false;
  }

  /**
   * Verifies the MD5 signature Click sends with every callback.
   *
   * Fails closed: the secret key is the only part of the signed string the
   * caller does not control — every other field comes straight out of the
   * request body. With an unconfigured (empty) key an attacker can compute a
   * valid signature themselves, so an unconfigured provider must reject all
   * callbacks instead of accepting them.
   *
   * The service id is also pinned to our own configuration: it is part of
   * the signed string, so without this check a caller could sign a callback
   * for an arbitrary service id.
   */
  verifyCallbackSignature(body: Record<string, unknown>): boolean {
    if (!this.secretKey || !this.serviceId) {
      this.logger.error(
        'CLICK_SECRET_KEY / CLICK_SERVICE_ID not set — rejecting callback verification',
      );
      return false;
    }

    try {
      const {
        click_trans_id,
        service_id,
        merchant_trans_id,
        amount,
        action,
        sign_time,
        sign_string,
      } = body as Record<string, string | number>;

      if (typeof sign_string !== 'string' || !sign_string) {
        return false;
      }

      if (String(service_id) !== this.serviceId) {
        this.logger.warn(
          `Click callback for unknown service_id=${String(service_id)} — rejected`,
        );
        return false;
      }

      const signatureString = `${click_trans_id}${service_id}${this.secretKey}${merchant_trans_id}${amount}${action}${sign_time}`;

      const expectedSignature = createHash('md5')
        .update(signatureString)
        .digest('hex');

      return timingSafeCompare(sign_string.toLowerCase(), expectedSignature);
    } catch {
      return false;
    }
  }
}
