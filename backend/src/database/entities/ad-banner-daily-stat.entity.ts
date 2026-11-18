import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AdBanner } from './ad-banner.entity';

/**
 * Banner hisobotining kunlik kesimi (migratsiya 021).
 *
 * `ad_banners.impressions/clicks` jami sonni saqlashda davom etadi; bu jadval
 * reklama beruvchiga "qaysi kuni qancha" degan savolga javob beradi. Kun —
 * Toshkent vaqti bo'yicha (`Asia/Tashkent`), server qaysi zonada bo'lishidan
 * qat'i nazar. Banner o'chirilsa qatorlari ham o'chadi (CASCADE).
 */
@Entity('ad_banner_daily_stats')
export class AdBannerDailyStat {
  @PrimaryColumn({ name: 'banner_id', type: 'uuid' })
  bannerId: string;

  @PrimaryColumn({ type: 'date' })
  day: string;

  @ManyToOne(() => AdBanner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'banner_id' })
  banner: AdBanner;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;
}
