'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MapPin, PhoneCall, PlusCircle, RefreshCw, ShieldCheck, UserCog } from 'lucide-react';
import {
  getActiveSosAlerts,
  getNoDriversFoundExceptions,
  getOrderById,
  resolveSosAlert,
  Order,
  SosAlert,
} from '@/lib/api';
import { useDispatchData } from '@/components/dispatch/DispatchDataContext';
import { AssignDriverModal } from '@/components/dispatch/AssignDriverModal';
import { useNow } from '@/components/dispatch/useNow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CashDisputesSection } from '@/components/dispatch/CashDisputesSection';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { PageBody } from '@/components/ui/PageBody';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatDuration, formatPhone, shortId } from '@/lib/format';
import { clsx } from 'clsx';

const PAGE_LIMIT = 10;
const SOS_POLL_MS = 15_000;

/**
 * Age thresholds for visual escalation — the operator's cost is measured in
 * unresolved-minutes, so a card that has sat for half an hour must not look
 * like one that appeared ten seconds ago.
 */
const AGE_WARN_MS = 10 * 60_000;
const AGE_CRITICAL_MS = 30 * 60_000;

/** How long an exception has been sitting unresolved — the number that matters. */
function OpenFor({ since }: { since: string }) {
  const now = useNow(1000);
  if (now == null) return <span className="num text-xs text-subtle">—</span>;
  const age = now - new Date(since).getTime();
  return (
    <span
      className={clsx(
        'num text-xs',
        // The age itself escalates: quiet → warning-red as minutes pile up.
        age >= AGE_CRITICAL_MS
          ? 'font-semibold text-danger-deep dark:text-danger-light'
          : age >= AGE_WARN_MS
          ? 'text-danger-deep dark:text-danger-light'
          : 'text-subtle'
      )}
    >
      {formatDuration(Math.max(0, age))} beri
    </span>
  );
}

function SosCard({
  alert,
  onResolved,
  onOverride,
}: {
  alert: SosAlert;
  onResolved: (id: string) => void;
  onOverride: (order: Order) => void;
}) {
  const [isResolving, setIsResolving] = useState(false);
  const { toast } = useToast();
  // A minute-level clock is enough for threshold checks (OpenFor ticks by
  // itself every second).
  const now = useNow(30_000);
  const ageMs = now == null ? 0 : now - new Date(alert.createdAt).getTime();
  // SosAlert carries only an orderId, so the customer's phone and route are
  // pulled from the order itself — that's what makes "call the customer" and
  // "intervene" actionable straight from this card.
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrderById(alert.orderId)
      .then((o) => {
        if (!cancelled) setOrder(o);
      })
      .catch(() => {
        /* the alert still stands on its own without the order */
      });
    return () => {
      cancelled = true;
    };
  }, [alert.orderId]);

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await resolveSosAlert(alert.id);
      onResolved(alert.id);
      toast({ title: 'SOS signali hal qilindi', variant: 'success' });
    } catch (err) {
      console.error('Resolve SOS failed:', err);
      toast({
        title: 'Signalni yopib boʻlmadi',
        description: 'Qaytadan urinib koʻring.',
        variant: 'error',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const canOverride =
    !!order && ['created', 'searching', 'accepted', 'arrived'].includes(order.status);

  return (
    <Card
      padding="none"
      className={clsx(
        'overflow-hidden !border-danger/40',
        // An SOS that has sat unresolved past the threshold starts pulsing —
        // it must be impossible to mistake for a fresh one.
        ageMs >= AGE_WARN_MS && 'animate-pulse-ring !border-danger/70'
      )}
    >
      <div className="h-0.5 w-full bg-danger" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="danger" size="sm" dot>
                SOS
              </Badge>
              <span className="text-xs text-muted">
                {alert.reportedByRole === 'driver' ? 'Haydovchi' : 'Mijoz'} yubordi
              </span>
              <OpenFor since={alert.createdAt} />
            </div>

            <p className="text-[13px] text-ink mt-2">
              {order?.passenger?.name || 'Mijoz'} · buyurtma{' '}
              <span className="font-mono">{shortId(alert.orderId)}</span>
            </p>

            <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
              <MapPin size={12} className="shrink-0" />
              <span className="num">
                {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
              </span>
              {order?.pickupAddress && <span className="truncate">· {order.pickupAddress}</span>}
            </div>

            <p className="num text-[11px] text-subtle mt-1">{formatDateTime(alert.createdAt)}</p>
          </div>
        </div>

        {/* One-click actions — everything the operator needs on this card */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          {order?.passenger?.phone ? (
            <Button
              href={`tel:${order.passenger.phone}`}
              variant="secondary"
              size="sm"
              className="flex-1 min-w-[9rem]"
              leftIcon={<PhoneCall size={13} aria-hidden />}
            >
              Mijozga qoʻngʻiroq
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled className="flex-1 min-w-[9rem]">
              Telefon yuklanmoqda…
            </Button>
          )}

          {canOverride && (
            <Button
              size="sm"
              variant="override"
              leftIcon={<UserCog size={13} />}
              onClick={() => order && onOverride(order)}
              className="flex-1 min-w-[9rem]"
            >
              Qoʻlda aralashuv
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            onClick={handleResolve}
            isLoading={isResolving}
            leftIcon={<CheckCircle2 size={13} />}
            className="flex-1 min-w-[8rem]"
          >
            Hal qilindi
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * A "no driver found" exception. Muted red, not amber: red belongs to
 * unresolved exceptions (amber is the manual-override mark and nothing else),
 * and SOS above keeps the saturated red so this tier stays visually below it.
 * The card escalates as it ages — subtle → prominent.
 */
function NoDriverCard({ order }: { order: Order }) {
  const now = useNow(30_000);
  const ageMs = now == null ? 0 : now - new Date(order.createdAt).getTime();
  const escalation = ageMs >= AGE_CRITICAL_MS ? 2 : ageMs >= AGE_WARN_MS ? 1 : 0;

  return (
    <Card
      padding="none"
      className={clsx(
        'overflow-hidden',
        escalation === 1 && '!border-danger/40',
        escalation === 2 && '!border-danger/60 bg-danger-tint'
      )}
    >
      <div
        className={clsx(
          'w-full bg-danger',
          escalation === 0 && 'h-0.5 opacity-50',
          escalation === 1 && 'h-0.5',
          escalation === 2 && 'h-1'
        )}
      />
      <div className="p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-ink truncate">
              {order.passenger?.name || 'Mijoz'}
            </span>
            <span className="font-mono text-[11px] text-muted">{shortId(order.id)}</span>
            <OpenFor since={order.createdAt} />
          </div>
          <p className="text-xs text-muted truncate mt-0.5">{order.pickupAddress ?? '—'}</p>
          <p className="num text-[11px] text-subtle mt-0.5">
            {formatPhone(order.passenger?.phone)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {order.passenger?.phone && (
            <Button
              href={`tel:${order.passenger.phone}`}
              aria-label="Qoʻngʻiroq"
              variant="secondary"
              size="sm"
              leftIcon={<PhoneCall size={13} aria-hidden />}
            >
              <span className="hidden sm:inline">Qoʻngʻiroq</span>
            </Button>
          )}
          {/* Opening a fresh order is the routine remedy here, not an
              override — the cancelled order can't be reassigned. */}
          <Button
            href="/create-order"
            size="sm"
            variant="secondary"
            aria-label="Yangi buyurtma"
            leftIcon={<PlusCircle size={13} aria-hidden />}
          >
            <span className="hidden sm:inline">Yangi buyurtma</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Section title + count. The count is red only while it is non-zero. */
function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-h3 text-ink">{title}</h2>
      {count > 0 && (
        <Badge variant="danger" size="sm">
          {count}
        </Badge>
      )}
    </div>
  );
}

export default function ExceptionsPage() {
  const { drivers } = useDispatchData();

  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [sosLoading, setSosLoading] = useState(true);
  const [sosLoaded, setSosLoaded] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);

  const [noDriversOrders, setNoDriversOrders] = useState<Order[]>([]);
  const [noDriversTotal, setNoDriversTotal] = useState(0);
  const [noDriversPage, setNoDriversPage] = useState(1);
  const [noDriversLoading, setNoDriversLoading] = useState(true);
  const [noDriversLoaded, setNoDriversLoaded] = useState(false);
  const [noDriversError, setNoDriversError] = useState<string | null>(null);

  const [overrideOrder, setOverrideOrder] = useState<Order | null>(null);

  const fetchSos = useCallback(async () => {
    setSosLoading(true);
    try {
      setSosAlerts(await getActiveSosAlerts());
      setSosError(null);
      setSosLoaded(true);
    } catch (err) {
      console.error('Failed to load SOS alerts:', err);
      // The last good list stays on screen; the banner names the failure.
      setSosError('SOS signallarini yuklab boʻlmadi');
    } finally {
      setSosLoading(false);
    }
  }, []);

  const fetchNoDrivers = useCallback(async () => {
    setNoDriversLoading(true);
    try {
      const result = await getNoDriversFoundExceptions(noDriversPage, PAGE_LIMIT);
      setNoDriversOrders(result.data);
      setNoDriversTotal(result.total);
      setNoDriversError(null);
      setNoDriversLoaded(true);
    } catch (err) {
      console.error('Failed to load no-drivers-found exceptions:', err);
      setNoDriversError('Buyurtmalarni yuklab boʻlmadi');
    } finally {
      setNoDriversLoading(false);
    }
  }, [noDriversPage]);

  useEffect(() => {
    fetchSos();
    const interval = setInterval(fetchSos, SOS_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchSos]);

  useEffect(() => {
    fetchNoDrivers();
  }, [fetchNoDrivers]);

  const handleResolved = (id: string) => {
    setSosAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const totalPages = Math.max(1, Math.ceil(noDriversTotal / PAGE_LIMIT));
  const allClear =
    sosLoaded &&
    noDriversLoaded &&
    !sosError &&
    !noDriversError &&
    sosAlerts.length === 0 &&
    noDriversTotal === 0;

  return (
    <PageBody className="max-w-5xl">
      <PageHeader
        title="Istisnolar"
        // Poll-based page — the cadence is stated, never silent.
        description="Avtomatik tizim oʻzi hal qila olmagan holatlar · SOS har 15 soniyada yangilanadi"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchSos();
              fetchNoDrivers();
            }}
            isLoading={sosLoading && sosLoaded}
            leftIcon={<RefreshCw size={13} aria-hidden />}
          >
            Yangilash
          </Button>
        }
      />

      {/* An empty Exceptions queue is the healthy state — say so plainly. */}
      {allClear && (
        <Card padding="none" className="mb-6">
          <EmptyState
            variant="cleared"
            icon={<ShieldCheck aria-hidden />}
            title="Hammasi avtomatik ishlayapti"
            description="Haydovchilar tizim tomonidan tayinlanmoqda, xavfsizlik signallari yoʻq. Aralashuv talab qilinmaydi."
          />
        </Card>
      )}

      {/* SOS — always first, always red */}
      <section className="mb-8" aria-live="assertive">
        <SectionTitle title="SOS / Xavfsizlik" count={sosAlerts.length} />

        {sosError && sosLoaded && (
          <RetryBanner message={sosError} onRetry={fetchSos} keepsLastData className="mb-3" />
        )}

        {sosError && !sosLoaded ? (
          <Card padding="none">
            <ErrorState compact title={sosError} onRetry={fetchSos} retrying={sosLoading} />
          </Card>
        ) : !sosLoaded ? (
          <SkeletonCards count={2} height="h-32" />
        ) : sosAlerts.length === 0 ? (
          !allClear && (
            <Card padding="none">
              <EmptyState
                compact
                variant="cleared"
                icon={<ShieldCheck aria-hidden />}
                title="Aktiv SOS signali yoʻq"
                description="Barcha safarlar xavfsiz kechmoqda."
              />
            </Card>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {sosAlerts.map((alert) => (
              <SosCard
                key={alert.id}
                alert={alert}
                onResolved={handleResolved}
                onOverride={setOverrideOrder}
              />
            ))}
          </div>
        )}
      </section>

      {/* Kuryer do'konga to'ladim dedi, sotuvchi olmadim dedi */}
      <CashDisputesSection />

      {/* No drivers found */}
      <section>
        <SectionTitle title="Haydovchi topilmadi" count={noDriversTotal} />
        <p className="text-[13px] text-muted -mt-1.5 mb-3 leading-relaxed max-w-3xl">
          Matching servis qidiruv oynasidan keyin taslim boʻlgan buyurtmalar. Bunday buyurtma
          allaqachon bekor qilingan — unga haydovchi biriktirib boʻlmaydi. Mijoz qayta murojaat
          qilsa, «Buyurtma yaratish» orqali yangi buyurtma oching.
        </p>

        {noDriversError && noDriversLoaded && (
          <RetryBanner message={noDriversError} onRetry={fetchNoDrivers} keepsLastData className="mb-3" />
        )}

        {noDriversError && !noDriversLoaded ? (
          <Card padding="none">
            <ErrorState
              compact
              title={noDriversError}
              onRetry={fetchNoDrivers}
              retrying={noDriversLoading}
            />
          </Card>
        ) : !noDriversLoaded ? (
          <SkeletonCards count={3} height="h-[72px]" />
        ) : noDriversOrders.length === 0 ? (
          !allClear && (
            <Card padding="none">
              <EmptyState
                compact
                variant="cleared"
                icon={<CheckCircle2 aria-hidden />}
                title="Bunday holat yoʻq"
                description="Soʻnggi buyurtmalarning barchasiga haydovchi topilgan."
              />
            </Card>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {noDriversOrders.map((order) => (
              <NoDriverCard key={order.id} order={order} />
            ))}
            <Pagination
              page={noDriversPage}
              totalPages={totalPages}
              total={noDriversTotal}
              pageSize={PAGE_LIMIT}
              onPageChange={setNoDriversPage}
              className="border-t-0 px-0"
            />
          </div>
        )}
      </section>

      {/* Manual override, opened deliberately from an SOS card */}
      <AssignDriverModal
        isOpen={overrideOrder !== null}
        onClose={() => setOverrideOrder(null)}
        order={overrideOrder}
        availableDrivers={drivers}
        onAssigned={() => setOverrideOrder(null)}
      />
    </PageBody>
  );
}
