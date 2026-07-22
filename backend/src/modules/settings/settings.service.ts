import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';

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

  async getGlobalSettings(): Promise<{
    platformName: string;
    supportPhone: string;
    supportEmail: string;
    maintenanceMode: boolean;
  }> {
    const { platformName, supportPhone, supportEmail, maintenanceMode } = await this.getOrCreate();
    return { platformName, supportPhone, supportEmail, maintenanceMode };
  }

  async updateGlobalSettings(dto: {
    platformName?: string;
    supportPhone?: string;
    supportEmail?: string;
    maintenanceMode?: boolean;
  }): Promise<{
    platformName: string;
    supportPhone: string;
    supportEmail: string;
    maintenanceMode: boolean;
  }> {
    const settings = await this.getOrCreate();
    await this.settingsRepository.update(settings.id, dto);
    return this.getGlobalSettings();
  }
}
