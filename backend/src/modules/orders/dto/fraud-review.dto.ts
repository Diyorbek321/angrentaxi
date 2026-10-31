import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Menejer qarori: shubhali safar halolmi. */
export class FraudReviewDto {
  @ApiProperty({ description: 'true — safar halol, bonus beriladi' })
  @IsBoolean()
  approved: boolean;

  @ApiProperty({ required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
