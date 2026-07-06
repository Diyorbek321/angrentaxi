import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BonusRuleType } from '../../../database/entities/driver-bonus-rule.entity';

export class CreateBonusRuleDto {
  @ApiProperty({ example: '50 ta safar bonusi' })
  @IsString()
  name: string;

  @ApiProperty({ enum: BonusRuleType, example: BonusRuleType.TRIP_COUNT })
  @IsEnum(BonusRuleType)
  ruleType: BonusRuleType;

  @ApiProperty({ example: 50, description: 'Trip count threshold (per tier or per week)' })
  @IsInt()
  @Min(1)
  tripThreshold: number;

  @ApiProperty({ example: 50000, description: 'Bonus amount in UZS' })
  @IsNumber()
  @Min(0)
  bonusAmount: number;

  @ApiPropertyOptional({ example: 'taxi', description: 'Scope to a service type; omit for all' })
  @IsOptional()
  @IsString()
  serviceType?: string;
}
