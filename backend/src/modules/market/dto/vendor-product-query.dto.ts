import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CatalogModerationQueryDto } from '../../../common/dto/catalog-moderation-query.dto';
import { ProductStatus } from '../../../database/entities/product.entity';

/** Sotuvchi paneli "Mahsulotlar": sahifa, nom/SKU qidiruvi, holat va kategoriya filtri. */
export class VendorProductQueryDto extends CatalogModerationQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
