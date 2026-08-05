import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Pagination query parameters with no defaults of their own.
 *
 * Deliberately different from orders' `PaginationDto`, which defaults to
 * `page=1, limit=20`. This one is for endpoints that used to return everything
 * and are gaining pagination retroactively: leaving both fields `undefined`
 * lets the service apply its own (larger) default, so clients that send no
 * query string are not silently truncated to somebody else's page size.
 */
export class OptionalPaginationDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 50, description: 'Items per page' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
