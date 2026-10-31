import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { formBoolean } from '../../../common/utils/form-boolean.util';
import { LostItemStatus } from '../../../database/entities/lost-item-report.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReportLostItemDto {
  @ApiProperty({ description: 'Completed order the item was left on' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ example: "Qora charm hamyon, orqa o'rindiqda" })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description: string;
}

export class DriverLostItemResponseDto {
  @ApiProperty({ description: 'Did the driver find the item in the car?' })
  @Transform(formBoolean)
  @IsBoolean()
  found: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Operators only close a report: returned to the passenger, or not. */
export const OPERATOR_FINAL_STATUSES = [LostItemStatus.RETURNED, LostItemStatus.CLOSED] as const;

export class OperatorLostItemUpdateDto {
  @ApiProperty({ enum: OPERATOR_FINAL_STATUSES })
  @IsIn(OPERATOR_FINAL_STATUSES)
  status: (typeof OPERATOR_FINAL_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}
