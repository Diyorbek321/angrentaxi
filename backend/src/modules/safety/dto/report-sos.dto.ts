import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class ReportSosDto {
  @ApiProperty({ description: 'Latitude of the reporter at the moment of the alert', example: 41.0167 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ description: 'Longitude of the reporter at the moment of the alert', example: 70.1436 })
  @IsLongitude()
  lng: number;
}
