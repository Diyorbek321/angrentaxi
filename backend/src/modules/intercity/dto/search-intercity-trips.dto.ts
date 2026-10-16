import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

/** `GET /intercity/trips?routeId=&date=` — sana Toshkent kuni. */
export class SearchIntercityTripsDto {
  @ApiProperty({ description: "Yo'nalish UUID" })
  @IsUUID()
  routeId: string;

  @ApiProperty({ example: '2026-10-18', description: 'Toshkent kuni (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}
