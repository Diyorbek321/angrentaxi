import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AppFlavor = 'passenger' | 'driver';

export interface AppVersionPolicy {
  /** Bundan past build ishlamaydi — ilova "yangilang" ekranida to'xtaydi. */
  minBuild: number;
  /** Eng yangi build — undan pastlarga yumshoq taklif. */
  latestBuild: number;
  /** Yangi APK / do'kon sahifasi. Bo'sh bo'lsa ilova tugmani ko'rsatmaydi. */
  updateUrl: string | null;
}

/**
 * Ilova versiyasi siyosati (force/soft update).
 *
 * NEGA: xato APK haydovchilar qo'liga tushsa yoki backend o'zgarishi eski
 * ilovani buzsa, uni to'xtatishning yo'li yo'q edi. Qiymatlar `.env` dan:
 * `APP_MIN_BUILD_DRIVER`, `APP_LATEST_BUILD_DRIVER`, `APP_UPDATE_URL_DRIVER`
 * (passenger uchun ham xuddi shunday). Berilmasa — 0, ya'ni hech kim
 * bloklanmaydi.
 */
@Injectable()
export class AppVersionService {
  constructor(private readonly config: ConfigService) {}

  policyFor(flavor: AppFlavor): AppVersionPolicy {
    const suffix = flavor.toUpperCase();
    const minBuild = this.int(`APP_MIN_BUILD_${suffix}`);
    const latestBuild = Math.max(minBuild, this.int(`APP_LATEST_BUILD_${suffix}`));
    const updateUrl = this.config.get<string>(`APP_UPDATE_URL_${suffix}`)?.trim() || null;
    return { minBuild, latestBuild, updateUrl };
  }

  private int(key: string): number {
    const value = Number.parseInt(String(this.config.get(key) ?? ''), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
}
