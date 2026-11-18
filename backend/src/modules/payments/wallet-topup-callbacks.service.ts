import { Injectable, Logger } from '@nestjs/common';
import { WalletTopupStatus } from '../../database/entities/wallet-topup.entity';
import { WalletTopupsService } from './wallet-topups.service';
import { UzcardProvider } from './uzcard.provider';
import { strictTiyin } from './tiyin';

export interface UzcardTopupResponse {
  success: boolean;
  message: string;
}

/**
 * Hamyonni to'ldirish — UZPS callback'i (`order_id = topup_<id>`). Imzo
 * tekshiruvi `PaymentsService` da (buyurtma to'lovlari bilan umumiy).
 *
 * Payme va Click endi bu yerda EMAS: ikkala oqim (buyurtma + to'ldirish)
 * `merchant/payme-merchant.service.ts` va `merchant/click-shop.service.ts`
 * dagi yagona protokol implementatsiyasidan foydalanadi.
 */
@Injectable()
export class WalletTopupCallbacksService {
  private readonly logger = new Logger(WalletTopupCallbacksService.name);

  constructor(
    private readonly topups: WalletTopupsService,
    private readonly uzcard: UzcardProvider,
  ) {}

  // ------------------------------------------------------------------ UZPS

  /**
   * UZPS imzosi faqat `terminal_id&order_id&amount` ni qamraydi — `status` va
   * `transaction_id` ni EMAS (security review #7). Shuning uchun:
   *  · `transaction_id` majburiy va to'ldirishga bog'langan id bilan bir xil
   *    (`initiate` da saqlanadi);
   *  · PAID → kirimdan oldin provayder status API'si `PAID` deyishi shart;
   *  · to'langan to'ldirishni CANCELLED/FAILED bilan qaytarish — provayder
   *    `PAID` emasligini tasdiqlasagina;
   *  · `pending` dan boshqa holatdan PAID ga o'tish yo'q (`markPaid`).
   */
  async handleUzcard(body: Record<string, unknown>): Promise<UzcardTopupResponse> {
    const topup = await this.topups.findByReference(body['order_id']);
    if (!topup) return { success: false, message: 'ORDER_NOT_FOUND' };
    if (topup.provider !== 'uzcard') return { success: false, message: 'INVALID_STATE' };
    const status = body['status'];
    const transactionId = typeof body['transaction_id'] === 'string' ? body['transaction_id'] : null;
    if (!transactionId) return { success: false, message: 'INVALID_REQUEST' };
    if (topup.externalId && topup.externalId !== transactionId) {
      this.logger.warn(`UZPS callback for top-up ${topup.id} with foreign transaction ${transactionId}`);
      return { success: false, message: 'INVALID_STATE' };
    }

    if (status === 'PAID') {
      // UZPS summani tiyinda yuboradi — faqat butun tiyin (#10).
      const amountTiyin = strictTiyin(body['amount']);
      if (amountTiyin === null || !WalletTopupsService.amountMatches(topup, amountTiyin / 100)) {
        return { success: false, message: 'AMOUNT_MISMATCH' };
      }
      if (topup.status === WalletTopupStatus.PAID) {
        return topup.externalId === transactionId
          ? { success: true, message: 'OK' }
          : { success: false, message: 'INVALID_STATE' };
      }
      if (topup.status !== WalletTopupStatus.PENDING) return { success: false, message: 'INVALID_STATE' };
      if ((await this.uzcard.fetchStatus(transactionId)) !== 'PAID') {
        this.logger.warn(`UZPS PAID for top-up ${topup.id} not confirmed by status API (${transactionId})`);
        return { success: false, message: 'NOT_CONFIRMED' };
      }
      const outcome = await this.topups.markPaid(topup.id, {
        amount: amountTiyin / 100,
        externalId: transactionId,
        provider: 'uzcard',
      });
      if (outcome.kind === 'paid' || outcome.kind === 'already_paid') return { success: true, message: 'OK' };
      if (outcome.kind === 'amount_mismatch') return { success: false, message: 'AMOUNT_MISMATCH' };
      return { success: false, message: 'INVALID_STATE' };
    }
    if (status === 'FAILED' || status === 'CANCELLED') {
      if (topup.status === WalletTopupStatus.PAID) {
        const providerStatus = await this.uzcard.fetchStatus(transactionId);
        if (providerStatus === null || providerStatus === 'PAID') {
          this.logger.warn(`UZPS ${status} for paid top-up ${topup.id} not confirmed (provider: ${providerStatus ?? '—'})`);
          return { success: false, message: 'NOT_CONFIRMED' };
        }
      }
      await this.topups.cancel(
        topup.id,
        status === 'FAILED' ? WalletTopupStatus.FAILED : WalletTopupStatus.CANCELLED,
      );
      return { success: true, message: 'OK' };
    }
    return { success: true, message: 'OK' };
  }
}
