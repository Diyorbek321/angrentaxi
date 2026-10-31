import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class AddTipDto {
  /**
   * Chaqim summasi, so'mda.
   *
   * `@IsInt` ATAYLAB: pul birligi so'm va u butun son. `2000.555` kabi qiymat
   * `numeric(10,2)` ga yaxlitlanib, hisobotdagi jamlar tiyin darajasida
   * ajralib ketardi.
   *
   * Yuqori chegara — himoya to'siq. Xatolik bilan qo'shimcha nol qo'yilgan
   * summa (500 000 o'rniga 5 000 000) hamyonni bir zumda bo'shatishi mumkin.
   */
  @ApiProperty({ example: 5000, minimum: 1000, maximum: 200000 })
  @IsInt()
  @Min(1000)
  @Max(200000)
  amount: number;
}
