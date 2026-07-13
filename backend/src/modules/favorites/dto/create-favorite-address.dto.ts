import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFavoriteAddressDto {
  @ApiProperty({
    description: 'Short label for this place, e.g. "Uy" (Home) or "Ish" (Work)',
    example: 'Uy',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @ApiProperty({
    description: 'Human-readable address text',
    example: 'Angren sh., Mustaqillik ko\'chasi 12',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiProperty({ description: 'Latitude', example: 41.0167 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 70.1436 })
  @IsLongitude()
  lng: number;
}
