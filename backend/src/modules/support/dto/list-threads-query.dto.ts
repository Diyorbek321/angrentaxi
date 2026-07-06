import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../orders/dto/pagination.dto';
import { SupportThreadStatus } from '../../../database/entities/support-thread.entity';

export class ListThreadsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SupportThreadStatus })
  @IsOptional()
  @IsEnum(SupportThreadStatus)
  status?: SupportThreadStatus;
}
