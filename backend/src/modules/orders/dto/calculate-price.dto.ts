import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CalculatePriceDto {
  @ApiProperty({ example: 'uuid', description: 'Tariff ID' })
  @IsUUID()
  tariffId: string;

  @ApiProperty({ example: 5.2, description: 'Estimated distance in kilometers' })
  @IsNumber()
  @Min(0.1)
  @Max(500)
  distanceKm: number;

  @ApiProperty({ example: 12, description: 'Estimated duration in minutes' })
  @IsNumber()
  @Min(1)
  @Max(300)
  durationMin: number;

  // Pickup point, so the quote can include the live surge for that area.
  // Optional and backwards compatible: older clients that omit it simply get
  // the tariff's own multiplier, exactly as before.
  @ApiProperty({ example: 41.0212, required: false, description: 'Pickup latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  pickupLat?: number;

  @ApiProperty({ example: 70.0795, required: false, description: 'Pickup longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  pickupLng?: number;

  /**
   * Manzil nuqtasi. BERILSA — server marshrutni o'zi hisoblaydi va
   * mijozdagi `distanceKm` E'TIBORGA OLINMAYDI.
   *
   * ⚠️ NEGA MUHIM: buyurtma yaratilganda narx baribir server tomonda
   * hisoblanadi. Agar baholash mijoz raqamiga tayansa, ko'rsatilgan narx
   * bilan yozilgan narx farq qiladi — aynan shu nomuvofiqlik bor edi.
   * Manzil berilganda ikkala yo'l ham bitta hisob-kitobdan chiqadi.
   *
   * Ixtiyoriy va orqaga mos: eski mijozlar uni yubormaydi va avvalgidek
   * o'z masofasi bo'yicha baho oladi.
   */
  @ApiProperty({ example: 41.0512, required: false, description: 'Dropoff latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  dropoffLat?: number;

  @ApiProperty({ example: 70.1195, required: false, description: 'Dropoff longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  dropoffLng?: number;
}
