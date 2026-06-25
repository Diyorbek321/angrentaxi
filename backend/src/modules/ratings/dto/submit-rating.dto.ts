import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitRatingDto {
  @ApiProperty({ description: 'Order UUID to rate', format: 'uuid' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Rating score from 1 to 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({ description: 'Optional comment (max 500 chars)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
