import { formatDateShort, formatMoney } from '@/lib/format';
import type { VendorSettlementMode } from '@/lib/vendor-cash';
import { t } from '@/locales';

/**
 * `GET /settings/public` dan sotuvchi paneliga kerakli qism
 * (docs/LEGAL-COMPLIANCE.md §7, §10). `vendorSettlementMode` — AMALDAGI rejim.
 */
export interface VendorPublicSettings {
  vendorSettlementMode: VendorSettlementMode;
  vendorWalletSettlementFrom: string | null;
}

/** Realtime `vendor:wallet_settled` yuki. */
export interface WalletSettledEvent {
  kind: 'food' | 'market';
  vendorOrderId: string;
  amount: number;
  commission: number;
  net: number;
}

/** Realtime `vendor:wallet_reversed` yuki. */
export interface WalletReversedEvent {
  kind: 'food' | 'market';
  vendorOrderId: string;
  amount: number;
  commission: number;
}

/** Noma'lum/yaroqsiz javob — xavfsiz standart: bugungi naqd oqim. */
export function parsePublicSettings(raw: unknown): VendorPublicSettings {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const mode = obj.vendorSettlementMode === 'wallet' ? 'wallet' : 'cash';
  const from = typeof obj.vendorWalletSettlementFrom === 'string' ? obj.vendorWalletSettlementFrom : null;
  return { vendorSettlementMode: mode, vendorWalletSettlementFrom: from };
}

/**
 * Hamyon rejimiga o'tish oldidan ogohlantirish matni — faqat naqd rejimda va
 * sana kelajakda bo'lsa. Aks holda `null`.
 */
export function walletSwitchNotice(settings: VendorPublicSettings | null, now: number = Date.now()): string | null {
  if (!settings || settings.vendorSettlementMode !== 'cash' || !settings.vendorWalletSettlementFrom) return null;
  const at = Date.parse(settings.vendorWalletSettlementFrom);
  if (!Number.isFinite(at) || at <= now) return null;
  return t().settlement.switchNotice(formatDateShort(at));
}

export function walletSettledToast(e: WalletSettledEvent): { title: string; description: string } {
  const m = t().settlement;
  return {
    title: m.settledTitle,
    description: m.settledDescription(formatMoney(e.amount), formatMoney(e.commission), formatMoney(e.net)),
  };
}

export function walletReversedToast(e: WalletReversedEvent): { title: string; description: string } {
  const m = t().settlement;
  return {
    title: m.reversedTitle,
    description: m.reversedDescription(formatMoney(e.amount)),
  };
}
