import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateStoreAdminDto {
  @ApiProperty({ example: '+998901234599', description: "Vendor owner's login phone" })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ example: 'Dilnoza' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rashidova' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({ example: 'Yangi Bozor' })
  @IsString()
  @MaxLength(150)
  storeName: string;

  @ApiPropertyOptional({ example: "Angren sh., Bozor ko'chasi 20" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  storeAddress?: string;

  @ApiPropertyOptional({ example: '+998901234598', description: 'Store contact phone, defaults to owner phone' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  storePhone?: string;

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
