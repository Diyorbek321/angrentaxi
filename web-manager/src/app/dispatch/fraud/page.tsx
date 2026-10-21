'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { FraudReviewEntry, getFraudReviewQueue, reviewFraud } from '@/lib/api';
import { signalLabels, sortSignals } from '@/lib/fraud';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { PageBody } from '@/components/ui/PageBody';
import { ContactBlock } from '@/components/dispatch/ContactBlock';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatDuration, formatMoney, shortId } from '@/lib/format';
import { t } from '@/locales';

/**
 * Shubhali safarlar — haydovchi oʻzi oʻziga zakaz bergan boʻlishi mumkin.
 *
 * Tizim AYBLAMAYDI: safar toʻlov va komissiyada oddiydek oʻtgan, faqat bonus
 * va referal hisobiga kirmagan. "Halol" — bonus qaytariladi; "Firibgarlik" —
 * safar bonusga hech qachon kirmaydi (haydovchini bloklash alohida qaror,
 * "Haydovchilar" boʻlimida).
 */
export default function FraudReviewPage() {
  const m = t();
  const mf = m.control.fraud;
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
      setError(t().control.fraud.loadFailed);
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
        title: deciding.approved ? mf.markedHonest : mf.markedFraud,
        variant: 'success',
      });
      setDeciding(null);
      setNote('');
    } catch {
      toast({ title: mf.saveFailed, variant: 'error' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBody className="max-w-5xl">
        <PageHeader
          title={mf.title}
          description={mf.description}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              {m.common.refresh}
            </Button>
          }
        />

        {error && hasLoadedOnce && (
          <RetryBanner message={error} onRetry={() => void load()} keepsLastData className="mb-3" />
        )}

        {error && !hasLoadedOnce ? (
          <Card padding="none">
            <ErrorState title={error} onRetry={() => void load()} retrying={isLoading} />
          </Card>
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonCards count={3} height="h-[120px]" />
        ) : entries.length === 0 ? (
          <Card padding="none">
            <EmptyState
              variant="cleared"
              icon={<CheckCircle2 aria-hidden />}
              title={mf.emptyTitle}
              description={mf.emptyDescription}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <Card key={entry.orderId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {sortSignals(entry.signals).map((s) => (
                        <Badge key={s} variant={signalLabels()[s].strong ? 'danger' : 'neutral'} dot>
                          {signalLabels()[s].title}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-[13px] text-ink">
                      {entry.pickupAddress ?? '—'} → {entry.dropoffAddress ?? mf.taximeter}
                    </p>
                    <p className="mt-1 num text-xs text-subtle">
                      <span className="font-mono">{shortId(entry.orderId)}</span> ·{' '}
                      {entry.completedAt ? formatDateTime(entry.completedAt) : '—'} · {formatMoney(entry.finalPrice)}
                      {entry.distanceKm != null && ` · ${entry.distanceKm.toFixed(1)} km`}
                      {entry.durationMin != null && ` · ${formatDuration(entry.durationMin * 60_000)}`}
                      {` · ${mf.pairTrips(entry.pairTripsTotal)}`}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 sm:gap-4">
                    <ContactBlock label={mf.passenger} name={entry.passengerName} phone={entry.passengerPhone} />
                    <ContactBlock label={mf.driver} name={entry.driverName} phone={entry.driverPhone} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button size="sm" onClick={() => setDeciding({ entry, approved: true })}>
                    {mf.honestAction}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeciding({ entry, approved: false })}>
                    {mf.fraud}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal
        isOpen={deciding !== null}
        onClose={() => setDeciding(null)}
        title={deciding?.approved ? mf.honestTitle : mf.fraud}
        subtitle={
          deciding?.approved
            ? mf.honestSubtitle
            : mf.fraudSubtitle
        }
        size="md"
      >
        <Textarea
          label={mf.note}
          placeholder={deciding?.approved ? mf.honestPlaceholder : mf.fraudPlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={300}
        />
        <div className="mt-4 pt-4 border-t border-line flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeciding(null)}>
            {m.common.cancel}
          </Button>
          <Button variant={deciding?.approved ? 'primary' : 'danger'} isLoading={saving} onClick={() => void confirm()}>
            {m.common.save}
          </Button>
        </div>
      </Modal>
    </PageBody>
  );
}

