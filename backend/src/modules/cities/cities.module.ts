import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';
import { City } from '../../database/entities/city.entity';

// Eng quyi qatlamdagi modul: faqat o'z jadvaliga bog'lanadi, boshqa hech
// qaysi feature modulini olmaydi. Shuning uchun uni Orders/Tariffs/Drivers
// bemalol import qila oladi va aylanma bog'liqlik paydo bo'lmaydi.
@Module({
  imports: [TypeOrmModule.forFeature([City])],
  controllers: [CitiesController],
  providers: [CitiesService],
  exports: [CitiesService],
})
export class CitiesModule {}
