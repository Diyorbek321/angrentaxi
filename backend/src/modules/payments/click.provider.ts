import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { IPaymentProvider, PaymentInitiateResult } from './payment.interface';

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

  verifyCallbackSignature(body: Record<string, unknown>): boolean {
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

      const signatureString = `${click_trans_id}${service_id}${this.secretKey}${merchant_trans_id}${amount}${action}${sign_time}`;

      const expectedSignature = createHash('md5')
        .update(signatureString)
        .digest('hex');

      return sign_string === expectedSignature;
    } catch {
      return false;
    }
  }
}
