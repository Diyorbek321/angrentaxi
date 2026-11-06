import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CourierWalletRemindersService } from './courier-wallet-reminders.service';

/** 2026-12-12 dan oldin kuryerlarga hamyon eslatmasi (docs/LEGAL-COMPLIANCE.md §16). */
@Module({
  imports: [SettingsModule, NotificationsModule],
  providers: [CourierWalletRemindersService],
})
export class CourierWalletRemindersModule {}
