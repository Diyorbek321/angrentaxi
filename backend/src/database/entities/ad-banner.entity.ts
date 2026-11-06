import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * none       — banner faqat ko'rsatiladi, bosilganda hech narsa ochilmaydi
 * restaurant — ilova ichidagi restoran sahifasi (linkTarget = restaurants.id)
 * store      — ilova ichidagi do'kon sahifasi (linkTarget = stores.id)
 * url        — tashqi havola (faqat https://)
 */
export enum AdLinkType {
  NONE = 'none',
  RESTAURANT = 'restaurant',
  STORE = 'store',
  URL = 'url',
}

/**
 * Bosh ekrandagi reklama banneri (3-versiya).
 *
 * ⚠️ PUL TIZIMDAN TASHQARIDA: admin bannerni reklama beruvchi bilan
 * kelishgandan keyin qo'lda joylaydi. Shuning uchun bu yerda narx, hisob
 * yoki reklama beruvchi akkaunti yo'q — faqat ko'rsatish oynasi
 * (`startsAt`/`endsAt`) va reklama beruvchiga beriladigan hisobot uchun
 * `impressions`/`clicks`.
 *
 * Hisoblagichlar alohida jadvalda emas, shu qatorda: kerakli hisobot faqat
 * jami son va CTR. Kunlik kesim kerak bo'lgan kun kelsa — alohida jadval.
 */
@Index('idx_ad_banners_active_sort', ['isActive', 'sortOrder'])
@Entity('ad_banners')
export class AdBanner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Admin uchun nom va rasmning `alt` matni. Foydalanuvchiga ko'rinmaydi. */
  @Column({ type: 'varchar', length: 120 })
  title: string;

  /** Saqlash kaliti (`ads/<uuid>.<ext>`). Mijozga berilmaydi. */
  @Column({ name: 'image_key', type: 'varchar', length: 200, select: false })
  imageKey: string;

  @Column({
    name: 'link_type',
    type: 'enum',
    enum: AdLinkType,
    enumName: 'ad_banners_link_type_enum',
    default: AdLinkType.NONE,
  })
  linkType: AdLinkType;

  @Column({ name: 'link_target', type: 'varchar', length: 500, nullable: true })
  linkTarget: string | null;

  /** null = darhol boshlanadi. */
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  /** null = muddatsiz. */
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
