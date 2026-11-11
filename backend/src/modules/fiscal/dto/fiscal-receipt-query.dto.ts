import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../orders/dto/pagination.dto';
import {
  FiscalPrincipalType,
  FiscalReceiptStatus,
} from '../../../database/entities/fiscal-receipt.entity';
import { ServiceType } from '../../../database/entities/order.entity';

export class FiscalReceiptQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FiscalReceiptStatus })
  @IsOptional()
  @IsEnum(FiscalReceiptStatus)
  status?: FiscalReceiptStatus;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsIn(Object.values(ServiceType))
  serviceType?: string;

  @ApiPropertyOptional({ enum: FiscalPrincipalType })
  @IsOptional()
  @IsEnum(FiscalPrincipalType)
  principalType?: FiscalPrincipalType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00+05:00' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00+05:00' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
