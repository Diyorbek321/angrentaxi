import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

/** `GET /drivers/nearby-count` — yo'lovchining olish nuqtasi. */
export class NearbyCountQueryDto {
  @ApiProperty({ example: 41.0167 })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 70.1436 })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;
}
