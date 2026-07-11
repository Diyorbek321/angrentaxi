import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
