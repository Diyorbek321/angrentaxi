import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Xizmat ko'rsatiladigan shahar — markaz nuqtasi va radius bilan.
 *
 * ⚠️ NEGA DOIRA, POLIGON EMAS: shahar chegarasini poligon bilan chizish
 * aniqroq, lekin uni KIM chizadi va qayerda tahrirlaydi degan savol butun
 * boshqa quyi tizimni (xarita muharriri, GeoJSON import, PostGIS
 * `ST_Contains`) talab qiladi. O'zbek shaharlari uchun "markaz + radius"
 * amalda yetarli aniq va menejer uni bitta formadan boshqara oladi.
 * Poligon kerak bo'lgan kun kelsa, `resolveForPoint` ning ICHI o'zgaradi —
 * chaqiruvchilar uchun interfeys o'zgarmaydi.
 *
 * ⚠️ JADVAL BO'SH BO'LSA — CHEKLOV YO'Q. Bu tizim bo'ylab qabul qilingan
 * naqsh (`driver_verification_requirements` da ham xuddi shunday):
 * sozlanmagan qoida "hammasi taqiqlangan" degani EMAS. Shuning uchun bu
 * jadvalga migratsiya HECH QANDAY qator qo'ymaydi — Angren faqat seed'da
 * yoki menejer paneli orqali qo'shiladi. Aks holda migratsiya tushgan
 * lahzada qamrovdan tashqaridagi har bir buyurtma to'satdan rad etila
 * boshlardi.
 */
// Faol shaharlar ro'yxati `CitiesService` keshini to'ldirish uchun o'qiladi
// va menejer panelida shu tartibda ko'rsatiladi.
@Index('idx_cities_is_active_sort_order', ['isActive', 'sortOrder'])
@Entity('cities')
export class City {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  // Markaz koordinatasi. `decimal` (PostGIS `geometry` emas) — bu yerda
  // fazoviy so'rov qilinmaydi: masofa xotiradagi keshdan haversine bilan
  // hisoblanadi, ya'ni indeks ham, geometriya turi ham foyda bermaydi.
  @Column({
    name: 'center_lat',
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  centerLat: number;

  @Column({
    name: 'center_lng',
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  centerLng: number;

  @Column({
    name: 'radius_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  radiusKm: number;

  // Faol emas = qamrovdan chiqarilgan. Qator O'CHIRILMAYDI, chunki unga
  // bog'langan buyurtmalar tarixi (`orders.city_id`) ma'nosini yo'qotmasligi
  // kerak.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
