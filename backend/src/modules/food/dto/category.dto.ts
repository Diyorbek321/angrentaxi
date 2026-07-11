import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMenuCategoryDto {
  @ApiProperty({ example: 'Burgerlar' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMenuCategoryDto {
  @ApiPropertyOptional({ example: 'Burgerlar' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
