import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Sabab MAJBURIY (docs/INCIDENT-POLICY.md §3): foydalanuvchi kirishda va
 * push'da nega bloklanganini ko'radi — sababsiz blok shikoyatga sabab.
 */
export class BlockUserDto {
  @ApiProperty({ example: "Takroriy qo'pollik (3 ta tasdiqlangan shikoyat)", description: 'Bloklash sababi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Bloklash sababini yozing (kamida 3 belgi)' })
  @MaxLength(300)
  reason: string;
}
