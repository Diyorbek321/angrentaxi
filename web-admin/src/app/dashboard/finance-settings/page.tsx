'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { CommissionPromoCard } from '@/components/finance-settings/CommissionPromoCard';
import { ShiftPassSettingsCard } from '@/components/finance-settings/ShiftPassSettingsCard';
import { WalletTopupCard } from '@/components/finance-settings/WalletTopupCard';
import { VendorSettlementCard } from '@/components/finance-settings/VendorSettlementCard';

/**
 * Moliya sozlamalari — har karta o'z GET/PATCH'i bilan mustaqil yuklanadi va
 * saqlanadi (bittasi xato bersa, qolganlari ishlayveradi).
 */
export default function FinanceSettingsPage() {
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Moliya sozlamalari"
        description="Komissiya aksiyasi, smena, hamyonni toʻldirish va sotuvchi bilan hisob-kitob"
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
