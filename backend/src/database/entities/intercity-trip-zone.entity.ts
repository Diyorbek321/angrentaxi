import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { IntercityTrip } from './intercity-trip.entity';
import { IntercityZone } from './intercity-zone.entity';

/** Tuman qatnovning qaysi tomoniga tegishli: olish yoki tushirish. */
export enum IntercityZoneSide {
  ORIGIN = 'origin',
  DESTINATION = 'destination',
}

/**
 * Haydovchi e'londa tanlagan tuman (migratsiya 039). Qatnovda bitta tomon
 * uchun qator bo'lmasa — o'sha tomonda butun davom hududi ochiq.
 */
@Check('chk_intercity_trip_zones_side', `"side" IN ('origin', 'destination')`)
@Entity('intercity_trip_zones')
export class IntercityTripZone {
  @PrimaryColumn({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @PrimaryColumn({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @Column({ type: 'varchar', length: 12 })
  side: IntercityZoneSide;

  @ManyToOne(() => IntercityTrip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id', foreignKeyConstraintName: 'fk_intercity_trip_zones_trip' })
  trip?: IntercityTrip;

  @ManyToOne(() => IntercityZone, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'zone_id', foreignKeyConstraintName: 'fk_intercity_trip_zones_zone' })
  zone?: IntercityZone;
}
