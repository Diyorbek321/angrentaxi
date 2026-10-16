/**
 * Huquqiy talablar sozlamalari shakllari (docs/LEGAL-COMPLIANCE.md).
 * Sanalar API'da ISO satr, bazada `timestamptz`.
 */
import { TaxWithholdingPolicy } from '../tax/tax-withholding';
import { VendorSettlementMode } from '../delivery/vendor-settlement-mode';

export interface LegalComplianceSettings {
  /** `null` — VMQ 200 talablari majburlanmaydi (faqat ogohlantirish). */
  legalComplianceEnforcedFrom: string | null;
  minDriverAgeYears: number;
  minLicenceExperienceYears: number;
  maxVehicleAgeYears: number;
  taxWithholdingEnabled: boolean;
  /** Foiz: 1.0 = 1%. */
  driverTaxWithholdingRate: number;
  /**
   * Platforma STIR'i (9 raqam) — `principal_type = 'platform'` fiskal
   * yozuvlarida (smena). `null` — kiritilmagan.
   */
  platformTin: string | null;
}

export type LegalComplianceSettingsChanges = Partial<LegalComplianceSettings>;

export interface CommissionSettings {
  defaultCommissionRate: number;
  launchPromoCommissionUntil: string | null;
  launchPromoActive: boolean;
}

export interface CompletionFinancePolicy {
  defaultCommissionRate: number;
  launchPromoCommissionUntil: Date | null;
  taxWithholding: TaxWithholdingPolicy;
}

/** Sotuvchi bilan hisob-kitob (`delivery/vendor-settlement-mode.ts`). */
export interface VendorSettlementSettings {
  /** Admin tanlovi: 'cash' | 'wallet'. */
  vendorSettlementMode: VendorSettlementMode;
  /** Shu paytdan rejim baribir 'wallet'. `null` — sana yo'q. */
  vendorWalletSettlementFrom: string | null;
  /** Hozir amalda — ilovalar shunga qaraydi. */
  effectiveVendorSettlementMode: VendorSettlementMode;
}

export interface VendorSettlementSettingsChanges {
  vendorSettlementMode?: VendorSettlementMode;
  vendorWalletSettlementFrom?: string | null;
}

/** Smena (kunlik obuna) — `modules/shift-passes`. */
export interface ShiftPassSettings {
  shiftPassEnabled: boolean;
  /** So'm. */
  shiftPassPrice: number;
  shiftPassDurationHours: number;
  shiftPassServiceTypes: string[];
}

export type ShiftPassSettingsChanges = Partial<ShiftPassSettings>;

/** `GET /settings/public` — har qanday kirgan foydalanuvchi ilovasi uchun. */
export interface PublicSettings {
  platformName: string;
  supportPhone: string;
  deliveryFee: number;
  maxCashVendorOrder: number;
  /**
   * Bepul yetkazish chegarasi, so'm (tovar summasi aksiyadan keyin,
   * promokoddan oldin); 0 — o'chiq (docs/specs/food-market-ux-v5.md §7).
   */
  freeDeliveryFrom: number;
  /** Yetkazish vaqti oralig'i, daqiqa ("30–50 daq"). */
  deliveryEtaMinMinutes: number;
  deliveryEtaMaxMinutes: number;
  /** AMALDAGI rejim (sana hisobga olingan). */
  vendorSettlementMode: VendorSettlementMode;
  vendorWalletSettlementFrom: string | null;
  /** Hamyonni to'ldirish (§11) — ilova shu bilan tugmani ko'rsatadi/yashiradi. */
  walletTopupEnabled: boolean;
  walletTopupMin: number;
  walletTopupMax: number;
  walletTopupPresets: number[];
  /** Karta to'ldirishi shuncha kun yechib olinmaydi (ilova izohi uchun). */
  walletTopupHoldDays: number;
}

/** Haydovchi/kuryer hamyonini Payme/Click orqali to'ldirish (§11). */
export interface WalletTopupSettings {
  walletTopupEnabled: boolean;
  /** So'm. */
  walletTopupMin: number;
  walletTopupMax: number;
  walletTopupPresets: number[];
  /** Karta to'ldirishi shuncha kun yechib olinmaydi (sarflash mumkin). 0 — o'chiq. */
  walletTopupHoldDays: number;
  /** Menejer qo'lda tuzatishining |summa| chegarasi, so'm (admin — 5 000 000 gacha). */
  manualAdjustmentManagerLimit: number;
}

export type WalletTopupSettingsChanges = Partial<WalletTopupSettings>;
