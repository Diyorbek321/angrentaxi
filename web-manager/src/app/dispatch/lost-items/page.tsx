'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { closeLostItem, getLostItems, LostItemReport, LostItemStatus } from '@/lib/api';
import { isFinal, LOST_ITEM_STATUS_LABEL, needsDispatcher } from '@/lib/lost-items';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { PageBody } from '@/components/ui/PageBody';
import { ContactBlock } from '@/components/dispatch/ContactBlock';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, shortId } from '@/lib/format';

type Filter = 'active' | LostItemStatus;

const TABS: readonly { value: Filter; label: string }[] = [
  { value: 'active', label: 'Ochiq' },
  { value: 'found', label: 'Topilgan' },
  { value: 'open', label: 'Javob kutilmoqda' },
  { value: 'returned', label: 'Qaytarilgan' },
  { value: 'closed', label: 'Yopilgan' },
];

const STATUS_VARIANT: Record<LostItemStatus, BadgeVariant> = {
  // "Topilgan" waits on the dispatcher — info, not amber (amber = override only).
  open: 'neutral',
  found: 'info',
  not_found: 'neutral',
  returned: 'success',
  closed: 'neutral',
};

/**
 * Yo'qolgan buyumlar navbati.
 *
 * Dispetcher bu yerda ikki tomon telefonini ko'radi va topshirishni
 * kelishadi — haydovchi ham, yo'lovchi ham bir-birining raqamini ko'rmaydi.
 * "Topilgan" yuqorida: aynan u odam harakatini kutadi.
 */
export default function LostItemsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('active');
  const [items, setItems] = useState<LostItemReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<{ item: LostItemReport; status: 'returned' | 'closed' } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await getLostItems(filter === 'active' ? undefined : filter);
      const visible =
        filter === 'active'
          ? all
              .filter((i) => !isFinal(i.status))
              // "Topildi" birinchi — u dispetcherni kutyapti.
              .sort((a, b) => Number(b.status === 'found') - Number(a.status === 'found'))
          : all;
      setItems(visible);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError("Yoʻqolgan buyumlarni yuklab boʻlmadi");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmClose = async () => {
    if (!closing) return;
    setSaving(true);
    try {
      await closeLostItem(closing.item.id, closing.status, note.trim() || undefined);
      toast({
        title: closing.status === 'returned' ? 'Qaytarildi deb belgilandi' : 'Yopildi',
        variant: 'success',
      });
      setClosing(null);
      setNote('');
      await load();
    } catch {
      toast({ title: 'Saqlab boʻlmadi', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBody className="max-w-5xl">
        <PageHeader
          title="Yoʻqolgan buyumlar"
          description="Yoʻlovchi safarda qoldirgan narsalar — haydovchi javobi va topshirish"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
          }
        />

        <div className="mb-3">
          <SegmentedControl items={TABS} value={filter} onChange={setFilter} ariaLabel="Holat boʻyicha filtr" />
        </div>

        {error && hasLoadedOnce && (
          <RetryBanner message={error} onRetry={() => void load()} keepsLastData className="mb-3" />
        )}

        {error && !hasLoadedOnce ? (
          <Card padding="none">
            <ErrorState title={error} onRetry={() => void load()} retrying={isLoading} />
          </Card>
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonCards count={3} height="h-[120px]" />
        ) : items.length === 0 ? (
          <Card padding="none">
            <EmptyState
              variant="cleared"
              icon={<CheckCircle2 aria-hidden />}
              title="Hech narsa yoʻq"
              description="Bu boʻlimda koʻrib chiqiladigan xabar qolmadi."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <Card key={item.id} className={needsDispatcher(item.status) && item.status === 'found' ? 'border-info/50' : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[item.status]}>{LOST_ITEM_STATUS_LABEL[item.status]}</Badge>
                      <span className="num text-xs text-subtle">
                        <span className="font-mono">{shortId(item.orderId)}</span> · {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-semibold text-ink">{item.description}</p>
                    {item.driverNote && <p className="mt-1 text-xs text-muted">Haydovchi: {item.driverNote}</p>}
                    {item.operatorNote && <p className="mt-1 text-xs text-muted">Operator: {item.operatorNote}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 sm:gap-4">
                    <ContactBlock label="Yoʻlovchi" name={item.passengerName} phone={item.passengerPhone} />
                    <ContactBlock label="Haydovchi" name={item.driverName} phone={item.driverPhone} />
                  </div>
                </div>
                {!isFinal(item.status) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    <Button size="sm" onClick={() => setClosing({ item, status: 'returned' })}>
                      Qaytarildi
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setClosing({ item, status: 'closed' })}>
                      Qaytarilmasdan yopish
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

      <Modal
        isOpen={closing !== null}
        onClose={() => setClosing(null)}
        title={closing?.status === 'returned' ? 'Buyum qaytarildi' : 'Xabarni yopish'}
        subtitle={closing?.item.description}
        size="md"
      >
        <Textarea
          label="Izoh (ixtiyoriy)"
          placeholder="Masalan: ofisda yoʻlovchiga topshirildi"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <div className="mt-4 pt-4 border-t border-line flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setClosing(null)}>
            Bekor qilish
          </Button>
          <Button isLoading={saving} onClick={() => void confirmClose()}>
            Saqlash
          </Button>
        </div>
      </Modal>
    </PageBody>
  );
}

