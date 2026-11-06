'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { CommissionPromoCard } from '@/components/finance-settings/CommissionPromoCard';
import { ShiftPassSettingsCard } from '@/components/finance-settings/ShiftPassSettingsCard';
import { WalletTopupCard } from '@/components/finance-settings/WalletTopupCard';
import { VendorSettlementCard } from '@/components/finance-settings/VendorSettlementCard';
import { t } from '@/locales';

/**
 * Moliya sozlamalari — har karta o'z GET/PATCH'i bilan mustaqil yuklanadi va
 * saqlanadi (bittasi xato bersa, qolganlari ishlayveradi).
 */
export default function FinanceSettingsPage() {
  const m = t();
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={m.finance.settingsPage.title}
        description={m.finance.settingsPage.description}
      />
      <div className="max-w-3xl space-y-4">
        <CommissionPromoCard />
        <ShiftPassSettingsCard />
        <WalletTopupCard />
        <VendorSettlementCard />
      </div>
    </div>
  );
}
