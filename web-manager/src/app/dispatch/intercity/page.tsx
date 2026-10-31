'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TripBookings } from '@/components/intercity/TripBookings';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { Input } from '@/components/ui/Input';
import { KeyValue } from '@/components/ui/KeyValue';
import { Modal } from '@/components/ui/Modal';
import { PageBody } from '@/components/ui/PageBody';
import { PageHeader } from '@/components/ui/PageHeader';
import { PollStatus } from '@/components/ui/PollStatus';
import { Select } from '@/components/ui/Select';
import { formatDateTime, formatMoney, formatPhone, formatRating, formatTime } from '@/lib/format';
import { getIntercityTrips } from '@/lib/intercity-api';
import {
  INTERCITY_STATUS_BADGE,
  intercityStatusLabels,
  INTERCITY_TRIP_STATUSES,
  addDays,
  applyTripUpdate,
  isWholeCarBooked,
  seatsTaken,
  tashkentDate,
  tripClassLabel,
  type IntercityTripPage,
  type IntercityTripStatus,
  type IntercityTripUpdatedPayload,
  type IntercityTripView,
  zonesLabel,
} from '@/lib/intercity';
import { SOCKET_EVENTS, subscribeToSocket } from '@/lib/socket';
import { t } from '@/locales';

const PAGE_SIZE = 50;

/**
 * Asosiy manba — `intercity:trip:updated` socket hodisasi. Sekin so'rov faqat
 * zaxira: socket uzilib qolgan paytda o'tkazib yuborilgan hodisalar va yangi
 * e'lon qilingan qatnovlar (hodisa faqat mavjud qatnovga keladi) baribir
 * ko'rinsin.
 */
const FALLBACK_POLL_MS = 60_000;

function statusOptions() {
  return [
    { value: '', label: t().control.intercity.allStatuses },
    ...INTERCITY_TRIP_STATUSES.map((status) => ({ value: status, label: intercityStatusLabels()[status] })),
  ];
}

function routeName(trip: IntercityTripView): string {
  return `${trip.route.origin.name || '—'} → ${trip.route.destination.name || '—'}`;
}

/** Dispetcher: kun bo'yicha shaharlararo qatnovlar, to'lishi va holati. */
export default function IntercityTripsPage() {
  const m = t();
  const mi = m.control.intercity;
  const [date, setDate] = useState(() => tashkentDate());
  const [status, setStatus] = useState<IntercityTripStatus | ''>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IntercityTripPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [selected, setSelected] = useState<IntercityTripView | null>(null);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;
  const dataRef = useRef<IntercityTripPage | null>(null);
  dataRef.current = data;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getIntercityTrips({ date, status: status || undefined, page, limit: PAGE_SIZE });
      setData(result);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch {
      setError(t().control.intercity.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [date, status, page]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const handleTripUpdated = (payload: IntercityTripUpdatedPayload) => {
      const current = dataRef.current;
      const next = current ? applyTripUpdate(current, payload) : null;
      if (next) {
        setData(next);
        setLastUpdatedAt(Date.now());
      }
      if (selectedIdRef.current === payload.tripId) {
        setSelected((prev) => {
          if (!prev) return prev;
          const next = applyTripUpdate({ items: [prev], total: 1, page: 1, limit: 1 }, payload);
          return next ? next.items[0] : prev;
        });
        setBookingsRefreshKey((key) => key + 1);
      }
      // Ro'yxatda yo'q qatnov (yangi e'lon, boshqa sahifa) — to'liq yuklash.
      // Boshqa kundagi qatnov ham shu yo'ldan o'tadi; so'rov arzon, hodisa kam.
      if (current && !next) void load();
    };
    return subscribeToSocket((socket) => {
      socket.on(SOCKET_EVENTS.INTERCITY_TRIP_UPDATED, handleTripUpdated);
      return () => {
        socket.off(SOCKET_EVENTS.INTERCITY_TRIP_UPDATED, handleTripUpdated);
      };
    });
  }, [load]);

  const today = tashkentDate();
  const setDay = (next: string) => {
    setDate(next);
    setPage(1);
  };

  const columns: DataTableColumn<IntercityTripView>[] = [
    {
      key: 'departure',
      header: mi.departure,
      className: 'num whitespace-nowrap',
      cell: (t) => <span className="font-medium text-ink">{formatTime(t.departureAt)}</span>,
    },
    {
      key: 'route',
      header: mi.route,
      cell: (t) => <span className="text-ink">{routeName(t)}</span>,
    },
    { key: 'class', header: mi.tripClass, hideBelow: 'md', cell: (t) => tripClassLabel(t.tripClass) },
    {
      key: 'driver',
      header: mi.driver,
      hideBelow: 'lg',
      cell: (t) =>
        t.driver ? (
          <div className="min-w-0">
            <p className="truncate text-ink">{t.driver.firstName ?? mi.driver}</p>
            <p className="truncate text-xs text-muted">
              {[t.driver.carModel, t.driver.plate].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'seats',
      header: mi.seat,
      numeric: true,
      cell: (t) => (
        <div className="flex items-center justify-end gap-2">
          {isWholeCarBooked(t) && <Badge size="sm">{m.lib.intercity.wholeCar}</Badge>}
          <span>
            {seatsTaken(t)}/{t.seatsTotal}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: mi.status,
      cell: (t) => (
        <Badge variant={INTERCITY_STATUS_BADGE[t.status]} size="sm" dot>
          {intercityStatusLabels()[t.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{mi.actions}</span>,
      align: 'right',
      cell: (t) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(t);
          }}
        >
          {mi.details}
        </Button>
      ),
    },
  ];

  const rows = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <PageBody>
      <PageHeader
        title={mi.title}
        description={data ? mi.tripsCount(data.total, date) : mi.description}
        actions={
          <PollStatus lastUpdatedAt={lastUpdatedAt} isRefreshing={isLoading} onRefresh={load} error={error} />
        }
      />

      <DataTable
        ariaLabel={mi.tableAria}
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        loading={isLoading && !data}
        error={error}
        onRetry={load}
        onRowClick={setSelected}
        rowClassName={(t) => (t.status === 'cancelled' || t.status === 'completed' ? 'text-muted' : undefined)}
        isFiltered={status !== ''}
        onClearFilters={() => {
          setStatus('');
          setPage(1);
        }}
        empty={{
          title: mi.emptyTitle,
          description: mi.emptyDescription,
        }}
        toolbar={
          <FilterBar>
            <div className="flex items-center gap-1">
              <Button size="sm" variant={date === today ? 'secondary' : 'ghost'} onClick={() => setDay(today)}>
                {mi.today}
              </Button>
              <Button
                size="sm"
                variant={date === addDays(today, 1) ? 'secondary' : 'ghost'}
                onClick={() => setDay(addDays(today, 1))}
              >
                {mi.tomorrow}
              </Button>
            </div>
            <Input
              type="date"
              size="sm"
              aria-label={mi.departureDay}
              value={date}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              wrapperClassName="w-40"
            />
            <Select
              size="sm"
              aria-label={mi.statusAria}
              options={statusOptions()}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as IntercityTripStatus | '');
                setPage(1);
              }}
              wrapperClassName="w-48"
            />
          </FilterBar>
        }
        pagination={
          data && data.total > data.limit
            ? { page, totalPages, total: data.total, pageSize: data.limit, onPageChange: setPage }
            : undefined
        }
      />

      <Modal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? routeName(selected) : ''}
        subtitle={selected ? `${formatDateTime(selected.departureAt)} · ${tripClassLabel(selected.tripClass)}` : undefined}
        size="lg"
      >
        {selected && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <KeyValue label={mi.status}>
              <Badge variant={INTERCITY_STATUS_BADGE[selected.status]} size="sm" dot>
                {intercityStatusLabels()[selected.status]}
              </Badge>
            </KeyValue>
            <KeyValue label={mi.seats}>
              <span className="num">
                {mi.seatsSummary(seatsTaken(selected), selected.seatsLeft, selected.seatsTotal)}
              </span>
            </KeyValue>
            <KeyValue label={mi.seatPrice}>
              <span className="num">{formatMoney(selected.seatPrice)}</span>
            </KeyValue>
            <KeyValue label={m.lib.intercity.wholeCar}>
              <span className="num">{formatMoney(selected.wholeCarPrice)}</span>
            </KeyValue>
            <KeyValue label={mi.driver}>
              {selected.driver ? (
                <span>
                  {selected.driver.firstName ?? mi.driver} · ★ {formatRating(selected.driver.rating)}
                </span>
              ) : (
                '—'
              )}
            </KeyValue>
            <KeyValue label={mi.car}>
              {[selected.driver?.carModel, selected.driver?.plate].filter(Boolean).join(' · ') || '—'}
            </KeyValue>
            <KeyValue label={mi.driverPhone}>
              {selected.driver?.phone ? (
                <a href={`tel:${selected.driver.phone}`} className="num hover:underline">
                  {formatPhone(selected.driver.phone)}
                </a>
              ) : (
                '—'
              )}
            </KeyValue>
            <KeyValue label={mi.pickupZones(selected.route.origin.name)}>
              {zonesLabel(selected.zones?.origin)}
            </KeyValue>
            <KeyValue label={mi.dropoffZones(selected.route.destination.name)}>
              {zonesLabel(selected.zones?.destination)}
            </KeyValue>
            {isWholeCarBooked(selected) && (
              <KeyValue label={mi.bookingType}>
                <Badge size="sm">{m.lib.intercity.wholeCar}</Badge>
              </KeyValue>
            )}
            {selected.cancelReason && (
              <div className="col-span-2">
                <KeyValue label={mi.cancelReason}>{selected.cancelReason}</KeyValue>
              </div>
            )}
            <div className="col-span-2 mt-2">
              <p className="mb-2 text-sm font-medium text-ink">{mi.passengers}</p>
              <TripBookings tripId={selected.id} refreshKey={bookingsRefreshKey} onChanged={load} />
            </div>
          </div>
        )}
      </Modal>
    </PageBody>
  );
}
