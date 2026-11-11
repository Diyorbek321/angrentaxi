import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { AdBanner } from '../../database/entities/ad-banner.entity';
import { AdBannerDailyStat } from '../../database/entities/ad-banner-daily-stat.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';

// Restoran/do'kon jadvallari faqat havola mavjudligini tekshirish uchun
// o'qiladi — Food/Market modullari import qilinmaydi (aylanma bog'liqlik yo'q).
// OBJECT_STORAGE global StorageModule'dan keladi.
@Module({
  imports: [TypeOrmModule.forFeature([AdBanner, AdBannerDailyStat, Restaurant, Store])],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
