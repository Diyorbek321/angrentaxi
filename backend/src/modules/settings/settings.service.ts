import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import { normalizeTripOptionFees, TripOptionFees } from '../orders/trip-option-fees';

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

  async getCommissionSettings(): Promise<{ defaultCommissionRate: number }> {
    const settings = await this.getOrCreate();
    return { defaultCommissionRate: settings.defaultCommissionRate };
  }

  async setDefaultCommissionRate(rate: number): Promise<{ defaultCommissionRate: number }> {
    const settings = await this.getOrCreate();
    await this.settingsRepository.update(settings.id, { defaultCommissionRate: rate });
    return { defaultCommissionRate: rate };
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
