'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PhoneCall,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { formatDateTime, formatDuration, formatPhone, shortId } from '@/lib/format';

const PAGE_LIMIT = 10;

/** How long an exception has been sitting unresolved — the number that matters. */
function OpenFor({ since }: { since: string }) {
  const now = useNow(1000);
  if (now == null) return <span className="font-mono text-xs text-subtle">—</span>;
  return (
    <span className="font-mono text-xs text-subtle tabular-nums">
      {formatDuration(now - new Date(since).getTime())} beri
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
    } catch (err) {
      console.error('Resolve SOS failed:', err);
      window.alert('Signalni yopib boʻlmadi');
    } finally {
      setIsResolving(false);
    }
  };

  const canOverride =
    !!order && ['created', 'searching', 'accepted', 'arrived'].includes(order.status);

  return (
    <Card padding="none" className="overflow-hidden !border-danger/40">
      <div className="h-1 w-full bg-danger" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="h-9 w-9 rounded-xl bg-danger/12 flex items-center justify-center shrink-0">
            <ShieldAlert size={17} className="text-danger" />
          </span>

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

            <p className="text-sm text-ink mt-2">
              {order?.passenger?.name ?? 'Mijoz'} · buyurtma{' '}
              <span className="font-mono">{shortId(alert.orderId)}</span>
            </p>

            <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
              <MapPin size={12} className="shrink-0" />
              <span className="font-mono">
                {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
              </span>
              {order?.pickupAddress && <span className="truncate">· {order.pickupAddress}</span>}
            </div>

            <p className="text-[11px] text-subtle mt-1">{formatDateTime(alert.createdAt)}</p>
          </div>
        </div>

        {/* One-click actions — everything the operator needs on this card */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          {order?.passenger?.phone ? (
            <a href={`tel:${order.passenger.phone}`} className="flex-1 min-w-[9rem]">
              <Button size="sm" variant="secondary" leftIcon={<PhoneCall size={13} />} className="w-full">
                Mijozga qoʻngʻiroq
              </Button>
            </a>
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

function NoDriverCard({ order }: { order: Order }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="h-0.5 w-full bg-override" />
      <div className="p-3.5 flex items-start gap-3">
        <span className="h-8 w-8 rounded-xl bg-override/12 flex items-center justify-center shrink-0">
          <ShieldAlert size={15} className="text-override" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink truncate">
              {order.passenger?.name ?? 'Mijoz'}
            </span>
            <span className="font-mono text-[11px] text-muted">{shortId(order.id)}</span>
            <OpenFor since={order.createdAt} />
          </div>
          <p className="text-xs text-muted truncate mt-0.5">{order.pickupAddress ?? '—'}</p>
          <p className="font-mono text-[11px] text-subtle mt-0.5">
            {formatPhone(order.passenger?.phone)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {order.passenger?.phone && (
            <a href={`tel:${order.passenger.phone}`}>
              <Button size="sm" variant="secondary" leftIcon={<PhoneCall size={13} />}>
                <span className="hidden sm:inline">Qoʻngʻiroq</span>
              </Button>
            </a>
          )}
          <Link href="/create-order">
            <Button size="sm" variant="override" leftIcon={<PlusCircle size={13} />}>
              <span className="hidden sm:inline">Yangi buyurtma</span>
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function ExceptionsPage() {
  const { drivers } = useDispatchData();

  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [sosLoading, setSosLoading] = useState(true);
  const [sosError, setSosError] = useState<string | null>(null);

  const [noDriversOrders, setNoDriversOrders] = useState<Order[]>([]);
  const [noDriversTotal, setNoDriversTotal] = useState(0);
  const [noDriversPage, setNoDriversPage] = useState(1);
  const [noDriversLoading, setNoDriversLoading] = useState(true);
  const [noDriversError, setNoDriversError] = useState<string | null>(null);

  const [overrideOrder, setOverrideOrder] = useState<Order | null>(null);

  const fetchSos = useCallback(async () => {
    setSosLoading(true);
    try {
      setSosAlerts(await getActiveSosAlerts());
      setSosError(null);
    } catch (err) {
      console.error('Failed to load SOS alerts:', err);
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
    } catch (err) {
      console.error('Failed to load no-drivers-found exceptions:', err);
      setNoDriversError('Buyurtmalarni yuklab boʻlmadi');
    } finally {
      setNoDriversLoading(false);
    }
  }, [noDriversPage]);

  useEffect(() => {
    fetchSos();
    const interval = setInterval(fetchSos, 15000);
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
    !sosLoading && !noDriversLoading && sosAlerts.length === 0 && noDriversOrders.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Istisnolar"
          description="Avtomatik tizim oʻzi hal qila olmagan holatlar"
          icon={<ShieldAlert size={17} />}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                fetchSos();
                fetchNoDrivers();
              }}
              leftIcon={<RefreshCw size={13} />}
            >
              Yangilash
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatTile
            label="Aktiv SOS signallari"
            value={sosLoading ? '—' : sosAlerts.length}
            tone={sosAlerts.length > 0 ? 'danger' : 'mint'}
            live={sosAlerts.length > 0}
          />
          <StatTile
            label="Haydovchi topilmagan buyurtmalar"
            value={noDriversLoading ? '—' : noDriversTotal}
            tone={noDriversTotal > 0 ? 'override' : 'mint'}
          />
        </div>

        {/* An empty Exceptions queue is the healthy state — say so plainly */}
        {allClear && !sosError && !noDriversError && (
          <Card className="mb-6 !border-primary/30 bg-primary/[0.05]">
            <EmptyState
              tone="positive"
              icon={<ShieldCheck size={24} />}
              title="Istisnolar yoʻq — hammasi avtomatik ishlayapti"
              description="Haydovchilar tizim tomonidan tayinlanmoqda, xavfsizlik signallari yoʻq. Aralashuv talab qilinmaydi."
            />
          </Card>
        )}

        {/* SOS — always first, always red */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-ink">SOS / Xavfsizlik</h2>
            {sosAlerts.length > 0 && (
              <Badge variant="danger" size="sm">
                {sosAlerts.length}
              </Badge>
            )}
          </div>

          {sosError ? (
            <ErrorState compact message={sosError} onRetry={fetchSos} />
          ) : sosLoading && sosAlerts.length === 0 ? (
            <SkeletonCards count={2} height="h-32" />
          ) : sosAlerts.length === 0 ? (
            <Card>
              <EmptyState
                compact
                tone="positive"
                icon={<ShieldCheck size={20} />}
                title="Aktiv SOS signali yoʻq"
                description="Barcha safarlar xavfsiz kechmoqda."
              />
            </Card>
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

        {/* No drivers found */}
        <section>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-sm font-semibold text-ink">Haydovchi topilmadi</h2>
            {noDriversTotal > 0 && (
              <Badge variant="override" size="sm">
                {noDriversTotal}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Matching servis qidiruv oynasidan keyin taslim boʻlgan buyurtmalar. Bunday buyurtma
            allaqachon bekor qilingan — unga haydovchi biriktirib boʻlmaydi. Mijoz qayta murojaat
            qilsa, «Buyurtma yaratish» orqali yangi buyurtma oching.
          </p>

          {noDriversError ? (
            <ErrorState compact message={noDriversError} onRetry={fetchNoDrivers} />
          ) : noDriversLoading && noDriversOrders.length === 0 ? (
            <SkeletonCards count={3} height="h-20" />
          ) : noDriversOrders.length === 0 ? (
            <Card>
              <EmptyState
                compact
                tone="positive"
                icon={<CheckCircle2 size={20} />}
                title="Bunday holat yoʻq"
                description="Soʻnggi buyurtmalarning barchasiga haydovchi topilgan."
              />
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {noDriversOrders.map((order) => (
                  <NoDriverCard key={order.id} order={order} />
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted">
                  {noDriversPage} / {totalPages} sahifa · jami {noDriversTotal}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={noDriversPage <= 1}
                    onClick={() => setNoDriversPage((p) => p - 1)}
                    leftIcon={<ChevronLeft size={13} />}
                  >
                    Oldingi
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={noDriversPage * PAGE_LIMIT >= noDriversTotal}
                    onClick={() => setNoDriversPage((p) => p + 1)}
                    rightIcon={<ChevronRight size={13} />}
                  >
                    Keyingi
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Manual override, opened deliberately from an SOS card */}
      <AssignDriverModal
        isOpen={overrideOrder !== null}
        onClose={() => setOverrideOrder(null)}
        order={overrideOrder}
        availableDrivers={drivers}
        onAssigned={() => setOverrideOrder(null)}
      />
    </div>
  );
}
