import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CallTarget } from '../order-calls.service';

export class RequestCallDto {
  @ApiPropertyOptional({ enum: ['counterparty', 'recipient'], description: "Bo'lmasa — qarshi tomon" })
  @IsOptional()
  @IsIn(['counterparty', 'recipient'])
  target?: CallTarget;
}
