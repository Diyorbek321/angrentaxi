'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Phone, RefreshCw, ShieldAlert } from 'lucide-react';
import { FraudReviewEntry, getFraudReviewQueue, reviewFraud } from '@/lib/api';
import { SIGNAL_LABEL, sortSignals } from '@/lib/fraud';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatMoney, formatPhone } from '@/lib/format';

/**
 * Shubhali safarlar — haydovchi oʻzi oʻziga zakaz bergan boʻlishi mumkin.
 *
 * Tizim AYBLAMAYDI: safar toʻlov va komissiyada oddiydek oʻtgan, faqat bonus
 * va referal hisobiga kirmagan. "Halol" — bonus qaytariladi; "Firibgarlik" —
 * safar bonusga hech qachon kirmaydi (haydovchini bloklash alohida qaror,
 * "Haydovchilar" boʻlimida).
 */
export default function FraudReviewPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<FraudReviewEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ entry: FraudReviewEntry; approved: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setEntries(await getFraudReviewQueue());
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError('Shubhali safarlarni yuklab boʻlmadi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    if (!deciding) return;
    setSaving(true);
    try {
      await reviewFraud(deciding.entry.orderId, deciding.approved, note.trim() || undefined);
      setEntries((prev) => prev.filter((e) => e.orderId !== deciding.entry.orderId));
      toast({
        title: deciding.approved ? 'Halol deb belgilandi — bonus qaytarildi' : 'Firibgarlik deb belgilandi',
        variant: 'success',
      });
      setDeciding(null);
      setNote('');
    } catch {
      toast({ title: 'Saqlab boʻlmadi', variant: 'error' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Shubhali safarlar"
          description="Haydovchi oʻzi oʻziga zakaz bergan boʻlishi mumkin. Bonus va referal qaror chiqquncha ushlab turiladi."
          icon={<ShieldAlert size={17} />}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void load()} leftIcon={<RefreshCw size={13} />}>
              Yangilash
            </Button>
          }
        />

        {error && hasLoadedOnce && (
          <RetryBanner message={error} onRetry={() => void load()} keepsLastData className="mb-3" />
        )}

        {error && !hasLoadedOnce ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonTable rows={3} cols={4} />
        ) : entries.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              title="Shubhali safar yoʻq"
              description="Yangi belgi chiqsa shu yerda paydo boʻladi."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <Card key={entry.orderId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {sortSignals(entry.signals).map((s) => (
                        <Badge key={s} variant={SIGNAL_LABEL[s].strong ? 'danger' : 'warning'}>
                          {SIGNAL_LABEL[s].title}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-ink">
                      {entry.pickupAddress ?? '—'} → {entry.dropoffAddress ?? 'Taksometr'}
                    </p>
                    <p className="mt-1 font-mono text-xs text-subtle">
                      #{entry.orderId.slice(0, 8)} · {entry.completedAt ? formatDateTime(entry.completedAt) : '—'} ·{' '}
                      {formatMoney(entry.finalPrice)}
                      {entry.distanceKm != null && ` · ${entry.distanceKm.toFixed(1)} km`}
                      {entry.durationMin != null && ` · ${entry.durationMin} daq`}
                      {` · juftlikning jami safari: ${entry.pairTripsTotal}`}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 sm:gap-4">
                    <Contact label="Yoʻlovchi" name={entry.passengerName} phone={entry.passengerPhone} />
                    <Contact label="Haydovchi" name={entry.driverName} phone={entry.driverPhone} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-divider pt-3">
                  <Button size="sm" onClick={() => setDeciding({ entry, approved: true })}>
                    Halol — bonusni qaytarish
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeciding({ entry, approved: false })}>
                    Firibgarlik
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={deciding !== null}
        onClose={() => setDeciding(null)}
        title={deciding?.approved ? 'Safar halol' : 'Firibgarlik'}
        subtitle={
          deciding?.approved
            ? 'Safar bonus va referal hisobiga qoʻshiladi.'
            : 'Safar bonus hisobiga hech qachon kirmaydi. Haydovchini bloklash — “Haydovchilar” boʻlimida.'
        }
        size="md"
      >
        <Textarea
          label="Izoh (ixtiyoriy)"
          placeholder={deciding?.approved ? 'Masalan: haydovchi onasini olib yurgan' : 'Masalan: ikkala ilova bitta telefonda'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={300}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeciding(null)}>
            Bekor qilish
          </Button>
          <Button variant={deciding?.approved ? 'primary' : 'danger'} isLoading={saving} onClick={() => void confirm()}>
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
