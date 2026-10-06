import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripTrackPoint } from '../../database/entities/trip-track-point.entity';
import { OsrmService } from '../routing/osrm.service';
import { sampleForMatching, trackDistanceKm, type TrackPoint } from './track-distance';

export interface MeteredDistance {
  distanceKm: number;
  /** true — OSRM izni yo'lga moslab bergan masofa; false — xom GPS iz. */
  matched: boolean;
  /** Izdagi oxirgi nuqta — safar tugagan joy. */
  endPoint: { lat: number; lng: number } | null;
}

/**
 * Taksometr izi: yozish va masofani o'lchash.
 *
 * O'z modulida, chunki uni ham `DriversModule` (har GPS ping), ham
 * `OrdersModule` (safar yakuni) ishlatadi — OrdersModule esa DriversModule'ni
 * allaqachon import qiladi; aksincha bog'lash aylanma bog'liqlik bo'lardi.
 */
@Injectable()
export class TaximeterService {
  private readonly logger = new Logger(TaximeterService.name);

  constructor(
    @InjectRepository(TripTrackPoint)
    private readonly trackRepository: Repository<TripTrackPoint>,
    private readonly osrmService: OsrmService,
  ) {}

  /**
   * Haydovchining yangi joylashuvi — agar u hozir taksometrli safarda bo'lsa,
   * izga yoziladi. Bitta so'rov: buyurtma topilmasa hech narsa qo'shilmaydi.
   * `orders.driver_id` — haydovchining `users.id` si.
   *
   * ⚠️ TAKROR: ilova har fiksni IKKI yo'l bilan yuboradi (socket + HTTP
   * zaxira), ikkalasi ham shu yerga keladi. Oxirgi 10 soniyada aynan shu
   * nuqta yozilgan bo'lsa — o'tkazib yuboriladi (narxga baribir ta'sir
   * qilmasdi, lekin jadval ikki barobar o'sardi).
   */
  async recordForDriver(driverUserId: string, lat: number, lng: number): Promise<void> {
    await this.trackRepository.query(
      `INSERT INTO trip_track_points (order_id, lat, lng)
       SELECT o.id, $2, $3 FROM orders o
        WHERE o.driver_id = $1 AND o.status = 'in_progress' AND o.is_metered = true
          AND NOT EXISTS (
            SELECT 1 FROM trip_track_points t
             WHERE t.order_id = o.id AND t.lat = $2 AND t.lng = $3
               AND t.recorded_at > now() - interval '10 seconds'
          )
        LIMIT 1`,
      [driverUserId, lat, lng],
    );
  }

  /**
   * Haydovchining OXIRGI ma'lum joyini izga qo'shadi — safar boshlanganda
   * (iz bo'sh bo'lmasin) va tugaganda (oxirgi ping'dan keyingi metrlar
   * ham hisoblansin). Joylashuv hali kelmagan bo'lsa — olish nuqtasi.
   */
  async recordDriverPosition(orderId: string): Promise<void> {
    await this.trackRepository.query(
      `INSERT INTO trip_track_points (order_id, lat, lng)
       SELECT o.id,
              COALESCE(ST_Y(d.current_location::geometry), ST_Y(o.pickup_location::geometry)),
              COALESCE(ST_X(d.current_location::geometry), ST_X(o.pickup_location::geometry))
         FROM orders o
         LEFT JOIN drivers d ON d.user_id = o.driver_id
        WHERE o.id = $1`,
      [orderId],
    );
  }

  async points(orderId: string): Promise<TrackPoint[]> {
    const rows = await this.trackRepository.find({
      where: { orderId },
      order: { recordedAt: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => ({ lat: r.lat, lng: r.lng, recordedAt: r.recordedAt }));
  }

  /** Jonli hisoblagich uchun — arzon, OSRM'siz. */
  async liveDistanceKm(orderId: string): Promise<number> {
    return trackDistanceKm(await this.points(orderId));
  }

  /**
   * Yakuniy masofa. Avval OSRM `match` (GPS izini yo'lga moslash) — u
   * burilishlardagi kesib o'tishlarni to'g'rilaydi. Ishlamasa (server
   * javob bermadi, iz juda qisqa) — xom iz; jimgina kam undirishdan ko'ra
   * o'lchangan masofa yaxshiroq.
   */
  async finalDistance(orderId: string): Promise<MeteredDistance> {
    const points = await this.points(orderId);
    const raw = trackDistanceKm(points);
    const last = points[points.length - 1];
    const endPoint = last ? { lat: last.lat, lng: last.lng } : null;

    const sample = sampleForMatching(points);
    if (sample.length >= 2) {
      const matched = await this.osrmService.matchTrace(sample.map((p) => [p.lng, p.lat] as const));
      if (matched) {
        return { distanceKm: matched.distanceMeters / 1000, matched: true, endPoint };
      }
      this.logger.warn(`Order ${orderId}: OSRM match failed — raw GPS track used (${raw.toFixed(2)} km)`);
    }
    return { distanceKm: raw, matched: false, endPoint };
  }
}
