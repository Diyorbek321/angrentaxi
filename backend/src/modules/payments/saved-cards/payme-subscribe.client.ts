import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PAYMENT_PROVIDER_TIMEOUT_MS } from '../provider-http';
import { PAYME_ACCOUNT_FIELD } from '../merchant/payme-rpc';
import { somToTiyin } from '../tiyin';

/**
 * Payme Subscribe API (karta tokenlari + token bilan to'lov).
 *
 * ⚠️ So'rov/javob formatlari Payme'ning ochiq hujjatiga asoslangan
 * (developer.help.paycom.uz → Subscribe API) va sandbox'da TASDIQLANISHI
 * shart — shartnoma bilan kelgan hujjat ustun.
 *
 * Kalitlar:
 *  · `cards.*`    — `X-Auth: <merchant_id>` (ommaviy; ilova ham ishlatadi);
 *  · `receipts.*` — `X-Auth: <merchant_id>:<PAYME_SUBSCRIBE_KEY>` (maxfiy,
 *    faqat serverda). Bu Merchant API kaliti (`PAYME_SECRET_KEY`) EMAS.
 *
 * Karta raqami bu klient orqali o'tmaydi: karta ilovada `cards.create` →
 * `cards.get_verify_code` → `cards.verify` bilan bog'lanadi, serverga
 * faqat tayyor token keladi, server uni `cards.check` bilan tekshiradi.
 *
 * Sarlavhalar hech qachon log'ga yozilmaydi (axios xatosi `config.headers`
 * ni o'z ichiga oladi — shuning uchun faqat `describeError` matni).
 */
export const PAYME_SUBSCRIBE_DEFAULT_URL = 'https://checkout.paycom.uz/api';

/** Payme chek holati: 4 — to'langan, 50 — bekor qilingan (hujjat bo'yicha). */
export const PAYME_RECEIPT_PAID = 4;
export const PAYME_RECEIPT_CANCELLED = 50;

export interface PaymeCardInfo {
  maskedPan: string;
  expiry: string | null;
  verified: boolean;
  recurrent: boolean;
}

/**
 * Provayder javobi. `ambiguous` — tarmoq/timeout: pul yechilgan yoki
 * yechilmaganini bilmaymiz, chaqiruvchi chek holatini keyin tekshiradi.
 */
export type PaymeCallResult<T> =
  | { ok: true; value: T }
  | { ok: false; ambiguous: boolean; reason: string; rpcCode?: number };

interface RpcError {
  code?: number;
  message?: unknown;
}

interface RpcResponse<T> {
  result?: T;
  error?: RpcError;
}

interface CardPayload {
  card?: { number?: string; expire?: string; verify?: boolean; recurrent?: boolean };
}

interface ReceiptPayload {
  receipt?: { _id?: string; state?: number };
}

function describeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response ? `http_${err.response.status}` : (err.code ?? 'network_error');
  }
  return err instanceof Error ? err.message : 'unknown_error';
}

@Injectable()
export class PaymeSubscribeClient {
  private readonly logger = new Logger(PaymeSubscribeClient.name);

  constructor(private readonly config: ConfigService) {}

  private get merchantId(): string {
    return this.config.get<string>('PAYME_MERCHANT_ID', '') ?? '';
  }

  private get subscribeKey(): string {
    return this.config.get<string>('PAYME_SUBSCRIBE_KEY', '') ?? '';
  }

  /** Ilova ham shu manzilga `cards.*` yuboradi (test/jonli). */
  get apiUrl(): string {
    return this.config.get<string>('PAYME_SUBSCRIBE_API_URL', '') || PAYME_SUBSCRIBE_DEFAULT_URL;
  }

  /** Ilovaga beriladigan ommaviy identifikator (`cards.*` uchun). */
  get publicMerchantId(): string {
    return this.merchantId;
  }

  isConfigured(): boolean {
    return Boolean(this.merchantId && this.subscribeKey);
  }

  async checkCard(token: string): Promise<PaymeCallResult<PaymeCardInfo>> {
    const res = await this.call<CardPayload>('cards.check', { token }, false);
    if (!res.ok) return res;
    const card = res.value.card;
    if (!card?.number) return { ok: false, ambiguous: false, reason: 'card_missing' };
    return {
      ok: true,
      value: {
        maskedPan: card.number,
        expiry: card.expire ?? null,
        verified: card.verify === true,
        recurrent: card.recurrent === true,
      },
    };
  }

  async removeCard(token: string): Promise<PaymeCallResult<true>> {
    const res = await this.call<unknown>('cards.remove', { token }, false);
    return res.ok ? { ok: true, value: true } : res;
  }

  /** Chek yaratadi; `account.order_id` — Merchant API callback'lari shu bo'yicha buyurtmani topadi. */
  async createReceipt(amountSom: number, orderId: string): Promise<PaymeCallResult<string>> {
    const amount = somToTiyin(amountSom);
    if (amount === null || amount <= 0) return { ok: false, ambiguous: false, reason: 'invalid_amount' };
    const res = await this.call<ReceiptPayload>(
      'receipts.create',
      { amount, account: { [PAYME_ACCOUNT_FIELD]: orderId } },
      true,
    );
    if (!res.ok) return res;
    const id = res.value.receipt?._id;
    return id ? { ok: true, value: id } : { ok: false, ambiguous: false, reason: 'receipt_missing' };
  }

  /** Token bilan to'laydi; qaytaradi chek holati (4 — to'langan). */
  async payReceipt(receiptId: string, token: string): Promise<PaymeCallResult<number>> {
    return this.receiptState('receipts.pay', { id: receiptId, token });
  }

  async getReceiptState(receiptId: string): Promise<PaymeCallResult<number>> {
    return this.receiptState('receipts.check', { id: receiptId }, 'state');
  }

  async cancelReceipt(receiptId: string): Promise<PaymeCallResult<number>> {
    return this.receiptState('receipts.cancel', { id: receiptId });
  }

  private async receiptState(
    method: string,
    params: Record<string, unknown>,
    shape: 'receipt' | 'state' = 'receipt',
  ): Promise<PaymeCallResult<number>> {
    const res = await this.call<ReceiptPayload & { state?: number }>(method, params, true);
    if (!res.ok) return res;
    const state = shape === 'state' ? res.value.state : res.value.receipt?.state;
    return typeof state === 'number'
      ? { ok: true, value: state }
      : { ok: false, ambiguous: true, reason: 'state_missing' };
  }

  private async call<T>(
    method: string,
    params: Record<string, unknown>,
    privileged: boolean,
  ): Promise<PaymeCallResult<T>> {
    if (!this.isConfigured()) return { ok: false, ambiguous: false, reason: 'not_configured' };
    const auth = privileged ? `${this.merchantId}:${this.subscribeKey}` : this.merchantId;
    try {
      const { data } = await axios.post<RpcResponse<T>>(
        this.apiUrl,
        { id: Date.now(), method, params },
        {
          headers: { 'X-Auth': auth, 'Content-Type': 'application/json' },
          timeout: PAYMENT_PROVIDER_TIMEOUT_MS,
        },
      );
      if (data?.error) {
        const reason = `payme_${data.error.code ?? 'error'}`;
        this.logger.warn(`Payme ${method} rejected: ${reason}`);
        return {
          ok: false,
          ambiguous: false,
          reason,
          ...(typeof data.error.code === 'number' ? { rpcCode: data.error.code } : {}),
        };
      }
      if (data?.result === undefined) return { ok: false, ambiguous: true, reason: 'empty_result' };
      return { ok: true, value: data.result };
    } catch (err) {
      const reason = describeError(err);
      // 4xx — so'rov qabul qilinmadi; tarmoq/timeout/5xx — natija noma'lum.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const ambiguous = !(status && status >= 400 && status < 500);
      this.logger.error(`Payme ${method} failed: ${reason}`);
      return { ok: false, ambiguous, reason };
    }
  }
}
