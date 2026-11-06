/**
 * Fiskal chek provayderi (OFD / soliq.uz onlayn-NKT) abstraksiyasi.
 *
 * ⚠️ Haqiqiy integratsiya hisob ma'lumotlari HALI YO'Q (2026-10-15). Shuning
 * uchun standart — `NoopFiscalProvider`: yozuv yaratiladi, holati `skipped`.
 * Haqiqiy provayder qo'shilganda: shu interfeysni amalga oshiruvchi klass +
 * `createFiscalProvider` dagi yangi `case` + `FISCAL_PROVIDER=<nom>`.
 */
import { Logger } from '@nestjs/common';

export const FISCAL_PROVIDER = Symbol('FISCAL_PROVIDER');

/** Provayderga yuboriladigan chek ma'lumoti (entity'dan mustaqil). */
export interface FiscalReceiptPayload {
  receiptId: string;
  orderId: string;
  serviceType: string;
  principalType: string;
  principalPinfl: string | null;
  principalTin: string | null;
  platformRole: string;
  total: number;
  commissionAmount: number;
  paymentMethod: string;
  /** `sale` | `refund` — OFD'da qaytarish cheki sifatida yuboriladi. */
  receiptType: string;
  /** Qaytarishda asl sotuv cheki (bizning id) va uning OFD id'si. */
  originalReceiptId: string | null;
  originalExternalId: string | null;
}

export type FiscalSendResult =
  | { status: 'sent'; externalId: string; fiscalSign: string | null; qrUrl: string | null }
  | { status: 'skipped'; reason: string };

/** Xato — `throw`. Chaqiruvchi uni `failed` holatiga yozadi va qayta urinadi. */
export interface FiscalProvider {
  readonly name: string;
  send(payload: FiscalReceiptPayload): Promise<FiscalSendResult>;
}

export const NOOP_SKIP_REASON = 'provider not configured';

export class NoopFiscalProvider implements FiscalProvider {
  readonly name = 'noop';

  async send(): Promise<FiscalSendResult> {
    return { status: 'skipped', reason: NOOP_SKIP_REASON };
  }
}

/**
 * `FISCAL_PROVIDER` env bo'yicha tanlov. Noma'lum qiymat — ogohlantirish va
 * noop: noto'g'ri yozilgan env server yuklanishini to'xtatmasin, lekin jim
 * ham qolmasin.
 */
export function createFiscalProvider(name: string | undefined, logger?: Logger): FiscalProvider {
  const normalized = (name ?? 'noop').trim().toLowerCase() || 'noop';
  switch (normalized) {
    case 'noop':
      return new NoopFiscalProvider();
    default:
      logger?.warn(`FISCAL_PROVIDER="${normalized}" noma'lum — noop ishlatiladi`);
      return new NoopFiscalProvider();
  }
}
