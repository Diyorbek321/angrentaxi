'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PackageSearch, Phone, RefreshCw } from 'lucide-react';
import { closeLostItem, getLostItems, LostItemReport, LostItemStatus } from '@/lib/api';
import { isFinal, LOST_ITEM_STATUS_LABEL, needsDispatcher } from '@/lib/lost-items';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatPhone } from '@/lib/format';

type Filter = 'active' | LostItemStatus;

const TABS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Ochiq' },
  { value: 'found', label: 'Topilgan' },
  { value: 'open', label: 'Javob kutilmoqda' },
  { value: 'returned', label: 'Qaytarilgan' },
  { value: 'closed', label: 'Yopilgan' },
];

const STATUS_VARIANT: Record<LostItemStatus, BadgeVariant> = {
  open: 'info',
  found: 'warning',
  not_found: 'default',
  returned: 'success',
  closed: 'default',
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
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Yoʻqolgan buyumlar"
          description="Yoʻlovchi safarda qoldirgan narsalar — haydovchi javobi va topshirish"
          icon={<PackageSearch size={17} />}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void load()} leftIcon={<RefreshCw size={13} />}>
              Yangilash
            </Button>
          }
        />

        <div className="mb-3">
          <Tabs items={TABS} value={filter} onChange={setFilter} size="sm" />
        </div>

        {error && hasLoadedOnce && (
          <RetryBanner message={error} onRetry={() => void load()} keepsLastData className="mb-3" />
        )}

        {error && !hasLoadedOnce ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonTable rows={4} cols={4} />
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              title="Hech narsa yoʻq"
              description="Bu boʻlimda koʻrib chiqiladigan xabar qolmadi."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <Card key={item.id} className={needsDispatcher(item.status) && item.status === 'found' ? 'ring-1 ring-override/40' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[item.status]}>{LOST_ITEM_STATUS_LABEL[item.status]}</Badge>
                      <span className="font-mono text-xs text-subtle">
                        #{item.orderId.slice(0, 8)} · {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{item.description}</p>
                    {item.driverNote && <p className="mt-1 text-xs text-muted">Haydovchi: {item.driverNote}</p>}
                    {item.operatorNote && <p className="mt-1 text-xs text-muted">Operator: {item.operatorNote}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 sm:gap-4">
                    <Contact label="Yoʻlovchi" name={item.passengerName} phone={item.passengerPhone} />
                    <Contact label="Haydovchi" name={item.driverName} phone={item.driverPhone} />
                  </div>
                </div>
                {!isFinal(item.status) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-divider pt-3">
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
      </div>

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
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setClosing(null)}>
            Bekor qilish
          </Button>
          <Button isLoading={saving} onClick={() => void confirmClose()}>
            Saqlash
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Contact({ label, name, phone }: { label: string; name: string | null; phone: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="text-ink">{name ?? '—'}</p>
      {phone && (
        <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-mono text-primary-text hover:underline">
          <Phone size={11} aria-hidden />
          {formatPhone(phone)}
        </a>
      )}
    </div>
  );
}
