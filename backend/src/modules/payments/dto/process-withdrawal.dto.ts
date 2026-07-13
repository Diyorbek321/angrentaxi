import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WithdrawalStatus } from '../../../database/entities/withdrawal-request.entity';

export class ProcessWithdrawalDto {
  @ApiProperty({
    enum: [WithdrawalStatus.APPROVED, WithdrawalStatus.REJECTED, WithdrawalStatus.PAID],
    description: 'New status for the withdrawal request (admin only)',
  })
  @IsEnum(WithdrawalStatus)
  status: WithdrawalStatus;

  @ApiPropertyOptional({ example: 'Sent via card transfer 2026-07-13' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
