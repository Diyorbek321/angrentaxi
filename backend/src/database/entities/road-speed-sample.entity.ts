import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Yo'l tezligining agregat profili: "falon zonada, chorshanba kuni soat 18 da
 * o'rtacha necha km/soat yuriladi".
 *
 * NEGA xom GPS ping'lar saqlanmaydi. Angrenda kuniga yuzlab haydovchi har
 * necha soniyada joylashuv yuboradi — ularni jadvalga yozish kuniga millionlab
 * qator degani, va bu qatorlardan har bir haydovchining kun bo'yi qayerga
 * borgani (uyi, mijozlari, tanaffuslari) to'liq tiklanadi. Shuning uchun ping
 * kelgan zahoti tezlik hisoblanib SHU YERGA qo'shiladi va ping o'chib ketadi:
 * jadval hajmi zona x kun x soat bilan chegaralangan (bir necha ming qator),
 * trayektoriya esa umuman yozilmaydi.
 *
 * O'rtacha tezlik `speed_sum / sample_count` orqali olinadi. Ikkita ustun
 * saqlanishining sababi — yangi namunani qo'shish uchun eski o'rtachani
 * o'qib-hisoblab-qayta yozish shart emas: bitta `UPDATE ... + 1, ... + $` ham
 * atomar, ham parallel yozuvlarga chidamli.
 */
@Index('idx_road_speed_samples_zone_dow_hour', ['zone', 'dayOfWeek', 'hourOfDay'], {
  unique: true,
})
@Entity('road_speed_samples')
export class RoadSpeedSample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** H3 hujayra indeksi (rezolyutsiya SurgeService bilan bir xil). */
  @Column({ name: 'zone', type: 'varchar', length: 20 })
  zone: string;

  /** 0 = yakshanba ... 6 = shanba. Mahalliy (Toshkent) vaqtida. */
  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  /** 0..23, mahalliy (Toshkent) vaqtida. */
  @Column({ name: 'hour_of_day', type: 'smallint' })
  hourOfDay: number;

  @Column({ name: 'sample_count', type: 'integer', default: 0 })
  sampleCount: number;

  /** Barcha namunalar tezligining yig'indisi, km/soat. */
  @Column({ name: 'speed_sum', type: 'double precision', default: 0 })
  speedSum: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
