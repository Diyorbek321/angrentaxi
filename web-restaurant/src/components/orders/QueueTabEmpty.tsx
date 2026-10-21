import { BellRing, ChefHat, Inbox, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { QueueTab } from './queue';
import { t } from '@/locales';

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
  const m = t().orders.empty;
  if (tab === 'new') {
    return (
      <EmptyState
        variant="cleared"
        tone="positive"
        icon={<BellRing size={20} />}
        title={m.newTitle}
        description={m.newDescription}
      />
    );
  }
  if (tab === 'preparing') {
    return (
      <EmptyState
        variant="cleared"
        icon={<ChefHat size={20} />}
        title={m.preparingTitle}
        description={
          newCount > 0
            ? m.preparingWaiting(newCount)
            : m.preparingDescription
        }
        action={
          newCount > 0 ? (
            <Button variant="secondary" onClick={onGoToNew}>
              {m.goToNew}
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
        title={m.readyTitle}
        description={m.readyDescription}
      />
    );
  }
  return (
    <EmptyState
      variant="cleared"
      icon={<Inbox size={20} />}
      title={m.doneTitle}
      description={m.doneDescription}
    />
  );
}
