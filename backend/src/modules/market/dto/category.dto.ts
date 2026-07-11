import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Oziq-ovqat' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '🍚' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Oziq-ovqat' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '🍚' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
