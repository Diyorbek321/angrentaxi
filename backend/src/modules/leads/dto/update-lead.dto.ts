import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LEAD_STATUSES, LeadStatus } from '../../../database/entities/lead.entity';

export class UpdateLeadDto {
  @ApiProperty({ enum: LEAD_STATUSES })
  @IsIn(LEAD_STATUSES)
  status: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
