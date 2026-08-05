import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '../../../database/entities/order.entity';
import { PaginationDto } from './pagination.dto';

/**
 * Query DTO for `GET /orders` (admin/manager order list).
 *
 * `status` used to be a loose `@Query('status') status?: string` that the service
 * cast straight to `OrderStatus`. There was no injection risk — TypeORM
 * parameterises the value — but an unknown status silently produced an empty page
 * instead of telling the caller their filter was wrong. `@IsEnum` turns that into
 * a 400 listing the accepted values.
 *
 * It also has to live on the same DTO as the pagination fields: the global
 * ValidationPipe runs with `forbidNonWhitelisted`, so a `@Query()`-bound
 * PaginationDto rejects any query key it does not declare — which is what
 * `?status=` was.
 */
export class ListOrdersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Filter by order status',
  })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `status must be one of: ${Object.values(OrderStatus).join(', ')}`,
  })
  status?: OrderStatus;
}
