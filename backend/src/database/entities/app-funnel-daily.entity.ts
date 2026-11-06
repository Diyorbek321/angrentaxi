import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Ilova voronkasining kunlik hisoblagichi (migratsiya 043).
 *
 * Anonim TUZILISHIDAN: foydalanuvchi, qurilma yoki sessiya id'si yo'q — faqat
 * "shu kuni shu bosqichga necha marta yetildi". Kun — Toshkent sanasi.
 */
@Entity('app_funnel_daily')
export class AppFunnelDaily {
  @PrimaryColumn({ type: 'date' })
  day: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  app: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  step: string;

  @Column({ type: 'int', default: 0 })
  count: number;
}
