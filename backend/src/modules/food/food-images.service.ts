import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Dish } from '../../database/entities/dish.entity';
import { CatalogImageService } from '../storage/catalog-image.service';
import type { UploadedMemoryFile } from '../drivers/driver-uploads';

/**
 * Restoran muqovasi va taom rasmi. Fayl almashtirish/o'chirish qoidasi
 * `CatalogImageService`da; bu yer faqat qaysi qatorga yozilishini biladi.
 * `file` null — rasmni olib tashlash.
 */
@Injectable()
export class FoodImagesService {
  constructor(
    @InjectRepository(Restaurant) private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(Dish) private readonly dishRepo: Repository<Dish>,
    private readonly catalogImages: CatalogImageService,
  ) {}

  async setRestaurantImage(restaurantId: string, file: UploadedMemoryFile | null): Promise<Restaurant> {
    const restaurant = await this.restaurantRepo.findOne({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const save = (imageKey: string | null) => this.restaurantRepo.save({ ...restaurant, imageKey });
    return file
      ? this.catalogImages.replace(restaurant.imageKey, file, save)
      : this.catalogImages.clear(restaurant.imageKey, () => save(null));
  }

  async setDishImage(restaurantId: string, dishId: string, file: UploadedMemoryFile | null): Promise<Dish> {
    const dish = await this.dishRepo.findOne({ where: { id: dishId, restaurantId } });
    if (!dish) throw new NotFoundException('Dish not found');
    const save = (imageKey: string | null) => this.dishRepo.save({ ...dish, imageKey });
    return file
      ? this.catalogImages.replace(dish.imageKey, file, save)
      : this.catalogImages.clear(dish.imageKey, () => save(null));
  }
}
