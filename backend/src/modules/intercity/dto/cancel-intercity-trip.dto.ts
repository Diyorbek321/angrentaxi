import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelIntercityTripDto {
  @ApiProperty({ example: 'Mashina buzildi', description: "Sabab — yo'lovchilarga ko'rsatiladi" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
