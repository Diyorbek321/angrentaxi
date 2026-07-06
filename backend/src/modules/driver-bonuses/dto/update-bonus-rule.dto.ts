import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import {
  BonusRuleStatus,
  BonusRuleType,
} from '../../../database/entities/driver-bonus-rule.entity';

export class UpdateBonusRuleDto {
  @ApiPropertyOptional({ example: '50 ta safar bonusi' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: BonusRuleType })
  @IsOptional()
  @IsEnum(BonusRuleType)
  ruleType?: BonusRuleType;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  tripThreshold?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @ApiPropertyOptional({ example: 'taxi' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({ enum: BonusRuleStatus })
  @IsOptional()
  @IsEnum(BonusRuleStatus)
  status?: BonusRuleStatus;
}
