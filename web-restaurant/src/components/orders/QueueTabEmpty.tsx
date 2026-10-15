import { BellRing, ChefHat, Inbox, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { QueueTab } from './queue';

/**
 * Bo'sh tab — uch xil ma'no: yangi navbat bo'shligi YAXSHI (`cleared`),
 * oshxona bo'shligi neytral, jurnal bo'shligi kunning boshlanishi.
 */
export function QueueTabEmpty({
  tab,
  newCount,
  onGoToNew,
}: {
  tab: QueueTab;
  newCount: number;
  onGoToNew: () => void;
}) {
  if (tab === 'new') {
    return (
      <EmptyState
        variant="cleared"
        tone="positive"
        icon={<BellRing size={20} />}
        title="Yangi buyurtma yoʻq"
        description="Hammasi qabul qilingan. Yangisi kelganda signal chalinadi va shu tab hisoblagichi yonadi."
      />
    );
  }
  if (tab === 'preparing') {
    return (
      <EmptyState
        variant="cleared"
        icon={<ChefHat size={20} />}
        title="Oshxonada buyurtma yoʻq"
        description={
          newCount > 0
            ? `Yangi tabda ${newCount} ta buyurtma qabul kutmoqda.`
            : 'Yangi buyurtma qabul qilinganda u shu yerga tushadi.'
        }
        action={
          newCount > 0 ? (
            <Button variant="secondary" onClick={onGoToNew}>
              Yangi buyurtmalarga oʻtish
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (tab === 'ready') {
    return (
      <EmptyState
        variant="cleared"
        icon={<PackageCheck size={20} />}
        title="Topshirishga tayyor buyurtma yoʻq"
        description="«Tayyor deb belgilash» bosilgan buyurtmalar shu yerda kuryerni kutadi."
      />
    );
  }
  return (
    <EmptyState
      variant="cleared"
      icon={<Inbox size={20} />}
      title="Yakunlangan buyurtma yoʻq"
      description="Yetkazilgan va bekor qilingan buyurtmalar jurnali shu yerda koʻrinadi."
    />
  );
}
