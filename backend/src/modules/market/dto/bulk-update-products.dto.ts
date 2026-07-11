import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEnum, IsUUID } from 'class-validator';
import { ProductStatus } from '../../../database/entities/product.entity';

export class BulkUpdateProductsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  productIds: string[];

  @ApiProperty({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
