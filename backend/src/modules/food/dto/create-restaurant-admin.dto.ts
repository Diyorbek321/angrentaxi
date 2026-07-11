import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateRestaurantAdminDto {
  @ApiProperty({ example: '+998901234597', description: "Vendor owner's login phone" })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ example: 'Sardor' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Tohirov' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({ example: 'Osh Markazi' })
  @IsString()
  @MaxLength(150)
  restaurantName: string;

  @ApiPropertyOptional({ example: 'Toshkent, Yunusobod 4-mavze' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  restaurantAddress?: string;

  @ApiPropertyOptional({ example: '+998901234596', description: 'Restaurant contact phone, defaults to owner phone' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  restaurantPhone?: string;

  @ApiPropertyOptional({ example: 40.0956, description: 'Pickup latitude for courier dispatch' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 70.9432, description: 'Pickup longitude for courier dispatch' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
