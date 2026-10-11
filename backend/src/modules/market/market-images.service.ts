import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../../database/entities/store.entity';
import { Product } from '../../database/entities/product.entity';
import { CatalogImageService } from '../storage/catalog-image.service';
import type { UploadedMemoryFile } from '../drivers/driver-uploads';

/**
 * Do'kon muqovasi va mahsulot rasmi. Fayl almashtirish/o'chirish qoidasi
 * `CatalogImageService`da; bu yer faqat qaysi qatorga yozilishini biladi.
 * `file` null — rasmni olib tashlash.
 */
@Injectable()
export class MarketImagesService {
  constructor(
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly catalogImages: CatalogImageService,
  ) {}

  async setStoreImage(storeId: string, file: UploadedMemoryFile | null): Promise<Store> {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    const save = (imageKey: string | null) => this.storeRepo.save({ ...store, imageKey });
    return file
      ? this.catalogImages.replace(store.imageKey, file, save)
      : this.catalogImages.clear(store.imageKey, () => save(null));
  }

  async setProductImage(storeId: string, productId: string, file: UploadedMemoryFile | null): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id: productId, storeId } });
    if (!product) throw new NotFoundException('Product not found');
    const save = (imageKey: string | null) => this.productRepo.save({ ...product, imageKey });
    return file
      ? this.catalogImages.replace(product.imageKey, file, save)
      : this.catalogImages.clear(product.imageKey, () => save(null));
  }
}
