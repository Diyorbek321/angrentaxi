import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** SOS yopish — izoh majburiy (INCIDENT-POLICY §4). */
export class ResolveSosDto {
  @ApiProperty({ example: "Yo'lovchi bilan gaplashildi, hammasi joyida", minLength: 3, maxLength: 500 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'SOS yopish izohini yozing (kamida 3 belgi)' })
  @MaxLength(500)
  note: string;
}
