import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Driver taking too long', description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({
    example: 3000,
    description: "Ilova ko'rsatgan bekor qilish jarimasi (GET :id/cancel-fee). Server hisobi katta bo'lsa — 409",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  expectedFee?: number;
}
