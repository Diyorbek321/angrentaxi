import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import { normalizeTripOptionFees, TripOptionFees } from '../orders/trip-option-fees';
import { isLaunchPromoActive } from '../orders/commission-policy';
import {
  CommissionSettings,
  CompletionFinancePolicy,
  LegalComplianceSettings,
  LegalComplianceSettingsChanges,
  PublicSettings,
  ShiftPassSettings,
  ShiftPassSettingsChanges,
  VendorSettlementSettings,
  VendorSettlementSettingsChanges,
  WalletTopupSettings,
  WalletTopupSettingsChanges,
} from './legal-compliance-settings';
import {
  VendorSettlementMode,
  effectiveVendorSettlementMode,
} from '../delivery/vendor-settlement-mode';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepository: Repository<PlatformSettings>,
  ) {}

  // The single settings row is created lazily on first access rather than via
  // a seed migration, so a fresh DB never has to run one just for this.
  private async getOrCreate(): Promise<PlatformSettings> {
    const existing = await this.settingsRepository.find({ take: 1 });
    if (existing.length > 0) return existing[0];
    return this.settingsRepository.save(this.settingsRepository.create());
  }

  async getDefaultCommissionRate(): Promise<number> {
    const settings = await this.getOrCreate();
    return settings.defaultCommissionRate;
  }

  async getCommissionSettings(): Promise<CommissionSettings> {
    const settings = await this.getOrCreate();
    return toCommissionSettings(settings);
  }

  async setDefaultCommissionRate(rate: number): Promise<{ defaultCommissionRate: number }> {
    const settings = await this.getOrCreate();
    await this.settingsRepository.update(settings.id, { defaultCommissionRate: rate });
    return { defaultCommissionRate: rate };
  }

  /**
   * Ishga tushirish aksiyasi: shu sanagacha taksi komissiyasi 0
   * (`commission-policy.ts`). `null` — aksiyani o'chiradi.
   */
  async setLaunchPromoCommissionUntil(until: string | null): Promise<CommissionSettings> {
    const settings = await this.getOrCreate();
    const launchPromoCommissionUntil = parseOptionalDate(until, 'launchPromoCommissionUntil');
    await this.settingsRepository.update(settings.id, { launchPromoCommissionUntil });
    return toCommissionSettings({ ...settings, launchPromoCommissionUntil });
  }

  /** VMQ 200 / PQ-247 sozlamalari (docs/LEGAL-COMPLIANCE.md). */
  async getLegalComplianceSettings(): Promise<LegalComplianceSettings> {
    return toLegalComplianceSettings(await this.getOrCreate());
  }

  /** Faqat yuborilgan maydonlar o'zgaradi; `legalComplianceEnforcedFrom: null` — o'chiradi. */
  async updateLegalComplianceSettings(
    changes: LegalComplianceSettingsChanges,
  ): Promise<LegalComplianceSettings> {
    const settings = await this.getOrCreate();
    const { legalComplianceEnforcedFrom, platformTin, ...rest } = changes;
    if (platformTin !== undefined && platformTin !== null && !/^\d{9}$/.test(platformTin)) {
      throw new BadRequestException("platformTin: STIR 9 ta raqamdan iborat bo'lishi kerak");
    }
    const update: Partial<PlatformSettings> = {
      ...(platformTin !== undefined && { platformTin }),
      ...(legalComplianceEnforcedFrom !== undefined && {
        legalComplianceEnforcedFrom: parseOptionalDate(
          legalComplianceEnforcedFrom,
          'legalComplianceEnforcedFrom',
        ),
      }),
      ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
    };
    await this.settingsRepository.update(settings.id, update);
    return toLegalComplianceSettings({ ...settings, ...update });
  }

  /**
   * Safar yakunida pul hisobiga kerak bo'ladigan hamma narsa — bitta o'qish
   * (`OrdersCompletionService` → `FinancePolicyService`).
   */
  async getCompletionFinancePolicy(): Promise<CompletionFinancePolicy> {
    const settings = await this.getOrCreate();
    return {
      defaultCommissionRate: settings.defaultCommissionRate,
      launchPromoCommissionUntil: settings.launchPromoCommissionUntil ?? null,
      taxWithholding: {
        enabled: settings.taxWithholdingEnabled === true,
        ratePercent: settings.driverTaxWithholdingRate,
      },
    };
  }

  /** Sotuvchi bilan hisob-kitob rejimi (e-tijorat qonuni 23-modda). */
  async getVendorSettlementSettings(): Promise<VendorSettlementSettings> {
    return toVendorSettlementSettings(await this.getOrCreate(), new Date());
  }

  /** Hozir amaldagi rejim — `VendorCashService` shuni o'qiydi. */
  async getEffectiveVendorSettlementMode(): Promise<VendorSettlementMode> {
    const settings = await this.getOrCreate();
    return effectiveVendorSettlementMode(
      settings.vendorSettlementMode,
      settings.vendorWalletSettlementFrom ?? null,
      new Date(),
    );
  }

  async updateVendorSettlementSettings(
    changes: VendorSettlementSettingsChanges,
  ): Promise<VendorSettlementSettings> {
    const settings = await this.getOrCreate();
    const update: Partial<PlatformSettings> = {
      ...(changes.vendorSettlementMode !== undefined && {
        vendorSettlementMode: changes.vendorSettlementMode,
      }),
      ...(changes.vendorWalletSettlementFrom !== undefined && {
        vendorWalletSettlementFrom: parseOptionalDate(
          changes.vendorWalletSettlementFrom,
          'vendorWalletSettlementFrom',
        ),
      }),
    };
    await this.settingsRepository.update(settings.id, update);
    return toVendorSettlementSettings({ ...settings, ...update }, new Date());
  }

  /** Smena (kunlik obuna) sozlamalari. */
  async getShiftPassSettings(): Promise<ShiftPassSettings> {
    return toShiftPassSettings(await this.getOrCreate());
  }

  async updateShiftPassSettings(changes: ShiftPassSettingsChanges): Promise<ShiftPassSettings> {
    const settings = await this.getOrCreate();
    const { shiftPassServiceTypes, ...rest } = changes;
    const update: Partial<PlatformSettings> = {
      ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
      ...(shiftPassServiceTypes !== undefined && {
        shiftPassServiceTypes: [...new Set(shiftPassServiceTypes)],
      }),
    };
    await this.settingsRepository.update(settings.id, update);
    return toShiftPassSettings({ ...settings, ...update });
  }

  /** Platforma STIR'i — `principal_type = 'platform'` fiskal yozuvlari uchun. */
  async getPlatformTin(): Promise<string | null> {
    return (await this.getOrCreate()).platformTin ?? null;
  }

  /** Hamyonni to'ldirish sozlamalari (§11). */
  async getWalletTopupSettings(): Promise<WalletTopupSettings> {
    return toWalletTopupSettings(await this.getOrCreate());
  }

  /**
   * Faqat yuborilgan maydonlar o'zgaradi. Natija baribir izchil bo'lishi
   * shart: `min ≤ max` va har bir tezkor tugma shu oraliqda — aks holda
   * ilova bosilganda rad etiladigan tugmani ko'rsatardi.
   */
  async updateWalletTopupSettings(changes: WalletTopupSettingsChanges): Promise<WalletTopupSettings> {
    const settings = await this.getOrCreate();
    const current = toWalletTopupSettings(settings);
    const next: WalletTopupSettings = {
      walletTopupEnabled: changes.walletTopupEnabled ?? current.walletTopupEnabled,
      walletTopupMin: changes.walletTopupMin ?? current.walletTopupMin,
      walletTopupMax: changes.walletTopupMax ?? current.walletTopupMax,
      walletTopupPresets:
        changes.walletTopupPresets !== undefined
          ? [...new Set(changes.walletTopupPresets)].sort((a, b) => a - b)
          : current.walletTopupPresets,
      walletTopupHoldDays: changes.walletTopupHoldDays ?? current.walletTopupHoldDays,
      manualAdjustmentManagerLimit: changes.manualAdjustmentManagerLimit ?? current.manualAdjustmentManagerLimit,
    };
    if (next.walletTopupMin > next.walletTopupMax) {
      throw new BadRequestException("walletTopupMin walletTopupMax dan katta bo'lishi mumkin emas");
    }
    const outOfRange = next.walletTopupPresets.find(
      (preset) => preset < next.walletTopupMin || preset > next.walletTopupMax,
    );
    if (outOfRange !== undefined) {
      throw new BadRequestException(
        `walletTopupPresets: ${outOfRange} so'm ${next.walletTopupMin}–${next.walletTopupMax} oralig'idan tashqarida`,
      );
    }
    await this.settingsRepository.update(settings.id, { ...next });
    return next;
  }

  /** `GET /settings/public` — mijoz/kuryer/sotuvchi ilovalari uchun. */
  async getPublicSettings(): Promise<PublicSettings> {
    const settings = await this.getOrCreate();
    const vendor = toVendorSettlementSettings(settings, new Date());
    return {
      platformName: settings.platformName,
      supportPhone: settings.supportPhone,
      deliveryFee: settings.deliveryFee,
      maxCashVendorOrder: settings.maxCashVendorOrder,
      vendorSettlementMode: vendor.effectiveVendorSettlementMode,
      vendorWalletSettlementFrom: vendor.vendorWalletSettlementFrom,
      ...publicWalletTopupSettings(toWalletTopupSettings(settings)),
    };
  }

  /** Flat per-order delivery fee for the food/market verticals. */
  async getDeliveryFee(): Promise<number> {
    const { deliveryFee } = await this.getOrCreate();
    return deliveryFee;
  }

  /** Naqd ovqat/market buyurtmasi chegarasi (so'm). */
  async getMaxCashVendorOrder(): Promise<number> {
    const { maxCashVendorOrder } = await this.getOrCreate();
    return maxCashVendorOrder;
  }

  /** Safar opsiyalari haqi — faqat haqi > 0 bo'lgan opsiyalar. */
  async getTripOptionFees(): Promise<TripOptionFees> {
    const { tripOptionFees } = await this.getOrCreate();
    return normalizeTripOptionFees(tripOptionFees);
  }

  /**
   * Faqat yuborilgan opsiyalar o'zgaradi; `0` — o'sha opsiya haqi olib
   * tashlanadi. Boshlangan safarlarga ta'sir qilmaydi: ularning haqi
   * buyurtma quote'ida muzlatilgan.
   */
  async updateTripOptionFees(changes: TripOptionFees): Promise<TripOptionFees> {
    const settings = await this.getOrCreate();
    const merged = normalizeTripOptionFees({
      ...normalizeTripOptionFees(settings.tripOptionFees),
      ...changes,
    });
    await this.settingsRepository.update(settings.id, { tripOptionFees: merged });
    return merged;
  }

  async getGlobalSettings(): Promise<{
    platformName: string;
    supportPhone: string;
    supportEmail: string;
    maintenanceMode: boolean;
    deliveryFee: number;
    maxCashVendorOrder: number;
  }> {
    const { platformName, supportPhone, supportEmail, maintenanceMode, deliveryFee, maxCashVendorOrder } =
      await this.getOrCreate();
    return { platformName, supportPhone, supportEmail, maintenanceMode, deliveryFee, maxCashVendorOrder };
  }

  async updateGlobalSettings(dto: {
    platformName?: string;
    supportPhone?: string;
    supportEmail?: string;
    maintenanceMode?: boolean;
    deliveryFee?: number;
    maxCashVendorOrder?: number;
  }): Promise<{
    platformName: string;
    supportPhone: string;
    supportEmail: string;
    maintenanceMode: boolean;
    deliveryFee: number;
    maxCashVendorOrder: number;
  }> {
    const settings = await this.getOrCreate();
    await this.settingsRepository.update(settings.id, dto);
    return this.getGlobalSettings();
  }
}

function parseOptionalDate(value: string | null, field: string): Date | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field}: noto'g'ri sana`);
  }
  return date;
}

function toCommissionSettings(
  settings: Pick<PlatformSettings, 'defaultCommissionRate' | 'launchPromoCommissionUntil'>,
): CommissionSettings {
  const until = settings.launchPromoCommissionUntil ?? null;
  return {
    defaultCommissionRate: settings.defaultCommissionRate,
    launchPromoCommissionUntil: until ? until.toISOString() : null,
    launchPromoActive: isLaunchPromoActive(until, new Date()),
  };
}

function toLegalComplianceSettings(settings: PlatformSettings): LegalComplianceSettings {
  const enforcedFrom = settings.legalComplianceEnforcedFrom ?? null;
  return {
    legalComplianceEnforcedFrom: enforcedFrom ? enforcedFrom.toISOString() : null,
    minDriverAgeYears: settings.minDriverAgeYears,
    minLicenceExperienceYears: settings.minLicenceExperienceYears,
    maxVehicleAgeYears: settings.maxVehicleAgeYears,
    taxWithholdingEnabled: settings.taxWithholdingEnabled,
    driverTaxWithholdingRate: settings.driverTaxWithholdingRate,
    platformTin: settings.platformTin ?? null,
  };
}

const DEFAULT_WALLET_TOPUP_PRESETS: readonly number[] = [50000, 100000, 200000];
export const DEFAULT_WALLET_TOPUP_HOLD_DAYS = 7;
export const DEFAULT_MANUAL_ADJUSTMENT_MANAGER_LIMIT = 2_000_000;

/** Ilovaga — menejer chegarasi (ichki siyosat) chiqmaydi. */
function publicWalletTopupSettings(
  settings: WalletTopupSettings,
): Omit<WalletTopupSettings, 'manualAdjustmentManagerLimit'> {
  const { manualAdjustmentManagerLimit: _internal, ...visible } = settings;
  return visible;
}

function toWalletTopupSettings(
  settings: Partial<
    Pick<
      PlatformSettings,
      | 'walletTopupEnabled'
      | 'walletTopupMin'
      | 'walletTopupMax'
      | 'walletTopupPresets'
      | 'walletTopupHoldDays'
      | 'manualAdjustmentManagerLimit'
    >
  >,
): WalletTopupSettings {
  return {
    walletTopupEnabled: settings.walletTopupEnabled === true,
    walletTopupMin: Number(settings.walletTopupMin ?? 10000),
    walletTopupMax: Number(settings.walletTopupMax ?? 2000000),
    walletTopupPresets: (settings.walletTopupPresets ?? [...DEFAULT_WALLET_TOPUP_PRESETS]).map(Number),
    walletTopupHoldDays: Number(settings.walletTopupHoldDays ?? DEFAULT_WALLET_TOPUP_HOLD_DAYS),
    manualAdjustmentManagerLimit: Number(
      settings.manualAdjustmentManagerLimit ?? DEFAULT_MANUAL_ADJUSTMENT_MANAGER_LIMIT,
    ),
  };
}

function toVendorSettlementSettings(
  settings: Pick<PlatformSettings, 'vendorSettlementMode' | 'vendorWalletSettlementFrom'>,
  now: Date,
): VendorSettlementSettings {
  const from = settings.vendorWalletSettlementFrom ?? null;
  return {
    vendorSettlementMode: settings.vendorSettlementMode === 'wallet' ? 'wallet' : 'cash',
    vendorWalletSettlementFrom: from ? from.toISOString() : null,
    effectiveVendorSettlementMode: effectiveVendorSettlementMode(settings.vendorSettlementMode, from, now),
  };
}

function toShiftPassSettings(settings: PlatformSettings): ShiftPassSettings {
  return {
    shiftPassEnabled: settings.shiftPassEnabled === true,
    shiftPassPrice: settings.shiftPassPrice,
    shiftPassDurationHours: settings.shiftPassDurationHours,
    shiftPassServiceTypes: settings.shiftPassServiceTypes ?? ['taxi'],
  };
}
