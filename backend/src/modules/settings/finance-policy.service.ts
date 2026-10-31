import { Injectable } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CompletionFinancePolicy } from './legal-compliance-settings';

/**
 * Safar yakunidagi pul siyosati (komissiya aksiyasi + soliq ushlab qolish).
 *
 * NEGA ALOHIDA PROVAYDER: `OrdersCompletionService` uni `@Optional()` bilan
 * oladi. `SettingsService` ni qo'lda soxtalashtiradigan o'nlab unit spec'lar
 * bu metodni bilmaydi — provayder yo'q bo'lsa yakunlash avvalgidek ishlaydi
 * (aksiya yo'q, ushlab qolish yo'q), ya'ni standart xulq aynan saqlanadi.
 */
@Injectable()
export class FinancePolicyService {
  constructor(private readonly settingsService: SettingsService) {}

  get(): Promise<CompletionFinancePolicy> {
    return this.settingsService.getCompletionFinancePolicy();
  }
}
