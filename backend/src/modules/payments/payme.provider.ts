import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import axios from 'axios';
import { IPaymentProvider, PaymentInitiateResult } from './payment.interface';

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

  verifyCallbackSignature(body: Record<string, unknown>, authHeader: string): boolean {
    try {
      const base64Credentials = authHeader.replace('Basic ', '');
      const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [, password] = decoded.split(':');

      const expectedHash = createHash('sha1')
        .update(`${this.merchantId}${this.secretKey}`)
        .digest('hex');

      return password === this.secretKey || password === expectedHash;
    } catch {
      return false;
    }
  }
}
