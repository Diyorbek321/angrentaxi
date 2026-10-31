import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Taksometrli safar davomida haydovchidan kelgan GPS nuqtasi.
 *
 * Faqat `orders.is_metered = true` va `in_progress` buyurtmalar uchun
 * yoziladi: yakuniy narx aynan shu izdan hisoblanadi. Iz SAQLANADI (o'chirilmaydi)
 * — "nega shuncha?" degan nizoda dispetcher marshrutni ko'rsata oladi.
 */
@Index('idx_trip_track_points_order_time', ['orderId', 'recordedAt'])
@Entity('trip_track_points')
export class TripTrackPoint {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt: Date;
}
