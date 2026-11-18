import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { INTERRUPT_REASONS, InterruptReason } from '../../../database/entities/order.entity';

/** Safar uzildi (INCIDENT-POLICY §5). */
export class InterruptTripDto {
  @ApiProperty({ enum: INTERRUPT_REASONS, example: 'breakdown' })
  @IsIn([...INTERRUPT_REASONS])
  reason: InterruptReason;

  @ApiPropertyOptional({ example: 'Shina teshildi', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiPropertyOptional({ description: "Uzilish joyi (haydovchining joriy joyi)", example: 41.01 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 70.14 })
  @IsOptional()
  @IsLongitude()
  lng?: number;
}
