import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { computeWalletBalance } from '../payments/wallet-balance.util';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

/** Realtime hodisa nomi — haydovchi ilovasi hamyon ekranini shundan yangilaydi. */
export const WALLET_UPDATED_EVENT = 'wallet:updated';

export type WalletChangeReason =
  | 'topup'
  | 'topup_reversal'
  | 'manual_adjustment'
  | 'shift_pass_refund'
  | 'vendor_settlement_reversal'
  /** Karta to'lovi qaytarildi — ulush qaytarib olindi (§23). */
  | 'refund_clawback';

export interface WalletChangeNotice {
  /** Ishorali: + kirim, − chiqim. */
  delta: number;
  reason: WalletChangeReason;
  /** Push matni; bo'lmasa faqat realtime hodisa. */
  push?: { title: string; body: string; event: string };
  /** Hodisaga qo'shimcha maydonlar (masalan `topupId`). */
  extra?: Record<string, string | number | null>;
}

/** `wallet:updated` hodisasining shakli. */
export interface WalletUpdatedPayload {
  balance: number;
  delta: number;
  reason: WalletChangeReason;
  [key: string]: string | number | null;
}

/**
 * Hamyon o'zgarganini haydovchiga bildiradi — realtime `wallet:updated` +
 * push. Commit'dan KEYIN chaqiriladi va hech qachon otmaydi: pul allaqachon
 * daftarda, xabar yetmasa ham u to'g'ri.
 *
 * NEGA `DriversService` ichida emas: gateway `DriversService` ni oladi —
 * u yerga gateway kirsa aylanma bog'liqlik bo'lardi
 * (`driver-verification-reminders.service.ts` dagi sabab bilan bir xil).
 */
@Injectable()
export class WalletNotifierService {
  private readonly logger = new Logger(WalletNotifierService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async balanceChanged(userId: string, notice: WalletChangeNotice): Promise<void> {
    try {
      const balance = await computeWalletBalance(this.transactionRepository, userId);
      const payload: WalletUpdatedPayload = {
        ...(notice.extra ?? {}),
        balance,
        delta: notice.delta,
        reason: notice.reason,
      };
      this.realtimeGateway.emitToUser(userId, WALLET_UPDATED_EVENT, payload);
    } catch (err) {
      this.logger.error(`wallet:updated yuborilmadi (user ${userId}): ${(err as Error).message}`);
    }

    if (!notice.push) return;
    try {
      const user = await this.usersService.findById(userId);
      if (user) {
        await this.notificationsService.notifyWalletEvent(
          user,
          notice.push.title,
          notice.push.body,
          notice.push.event,
          { reason: notice.reason, delta: String(notice.delta) },
        );
      }
    } catch (err) {
      this.logger.error(`Hamyon push'i yuborilmadi (user ${userId}): ${(err as Error).message}`);
    }
  }
}
