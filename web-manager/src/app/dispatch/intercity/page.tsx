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
  INTERCITY_STATUS_LABELS,
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

const PAGE_SIZE = 50;

/**
 * Asosiy manba — `intercity:trip:updated` socket hodisasi. Sekin so'rov faqat
 * zaxira: socket uzilib qolgan paytda o'tkazib yuborilgan hodisalar va yangi
 * e'lon qilingan qatnovlar (hodisa faqat mavjud qatnovga keladi) baribir
 * ko'rinsin.
 */
const FALLBACK_POLL_MS = 60_000;

const STATUS_OPTIONS = [
  { value: '', label: 'Barcha holatlar' },
  ...INTERCITY_TRIP_STATUSES.map((status) => ({ value: status, label: INTERCITY_STATUS_LABELS[status] })),
];

function routeName(trip: IntercityTripView): string {
  return `${trip.route.origin.name || '—'} → ${trip.route.destination.name || '—'}`;
}

/** Dispetcher: kun bo'yicha shaharlararo qatnovlar, to'lishi va holati. */
export default function IntercityTripsPage() {
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
      setError('Qatnovlarni yuklab boʻlmadi');
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
      header: 'Joʻnash',
      className: 'num whitespace-nowrap',
      cell: (t) => <span className="font-medium text-ink">{formatTime(t.departureAt)}</span>,
    },
    {
      key: 'route',
      header: 'Yoʻnalish',
      cell: (t) => <span className="text-ink">{routeName(t)}</span>,
    },
    { key: 'class', header: 'Klass', hideBelow: 'md', cell: (t) => tripClassLabel(t.tripClass) },
    {
      key: 'driver',
      header: 'Haydovchi',
      hideBelow: 'lg',
      cell: (t) =>
        t.driver ? (
          <div className="min-w-0">
            <p className="truncate text-ink">{t.driver.firstName ?? 'Haydovchi'}</p>
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
      header: 'Oʻrindiq',
      numeric: true,
      cell: (t) => (
        <div className="flex items-center justify-end gap-2">
          {isWholeCarBooked(t) && <Badge size="sm">Butun mashina</Badge>}
          <span>
            {seatsTaken(t)}/{t.seatsTotal}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Holati',
      cell: (t) => (
        <Badge variant={INTERCITY_STATUS_BADGE[t.status]} size="sm" dot>
          {INTERCITY_STATUS_LABELS[t.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
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
          Batafsil
        </Button>
      ),
    },
  ];

  const rows = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <PageBody>
      <PageHeader
        title="Shaharlararo"
        description={data ? `${data.total} ta qatnov · ${date}` : 'Kun boʻyicha qatnovlar va ularning toʻlishi'}
        actions={
          <PollStatus lastUpdatedAt={lastUpdatedAt} isRefreshing={isLoading} onRefresh={load} error={error} />
        }
      />

      <DataTable
        ariaLabel="Shaharlararo qatnovlar"
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
          title: 'Bu kunga qatnov yoʻq',
          description: 'Haydovchilar ilovadan qatnov eʼlon qilganda shu yerda paydo boʻladi.',
        }}
        toolbar={
          <FilterBar>
            <div className="flex items-center gap-1">
              <Button size="sm" variant={date === today ? 'secondary' : 'ghost'} onClick={() => setDay(today)}>
                Bugun
              </Button>
              <Button
                size="sm"
                variant={date === addDays(today, 1) ? 'secondary' : 'ghost'}
                onClick={() => setDay(addDays(today, 1))}
              >
                Ertaga
              </Button>
            </div>
            <Input
              type="date"
              size="sm"
              aria-label="Joʻnash kuni"
              value={date}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              wrapperClassName="w-40"
            />
            <Select
              size="sm"
              aria-label="Holat"
              options={STATUS_OPTIONS}
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
            <KeyValue label="Holati">
              <Badge variant={INTERCITY_STATUS_BADGE[selected.status]} size="sm" dot>
                {INTERCITY_STATUS_LABELS[selected.status]}
              </Badge>
            </KeyValue>
            <KeyValue label="Oʻrindiqlar">
              <span className="num">
                {seatsTaken(selected)} band · {selected.seatsLeft} boʻsh · jami {selected.seatsTotal}
              </span>
            </KeyValue>
            <KeyValue label="Oʻrindiq narxi">
              <span className="num">{formatMoney(selected.seatPrice)}</span>
            </KeyValue>
            <KeyValue label="Butun mashina">
              <span className="num">{formatMoney(selected.wholeCarPrice)}</span>
            </KeyValue>
            <KeyValue label="Haydovchi">
              {selected.driver ? (
                <span>
                  {selected.driver.firstName ?? 'Haydovchi'} · ★ {formatRating(selected.driver.rating)}
                </span>
              ) : (
                '—'
              )}
            </KeyValue>
            <KeyValue label="Mashina">
              {[selected.driver?.carModel, selected.driver?.plate].filter(Boolean).join(' · ') || '—'}
            </KeyValue>
            <KeyValue label="Haydovchi telefoni">
              {selected.driver?.phone ? (
                <a href={`tel:${selected.driver.phone}`} className="num hover:underline">
                  {formatPhone(selected.driver.phone)}
                </a>
              ) : (
                '—'
              )}
            </KeyValue>
            <KeyValue label={`Olish tumanlari (${selected.route.origin.name})`}>
              {zonesLabel(selected.zones?.origin)}
            </KeyValue>
            <KeyValue label={`Tushirish tumanlari (${selected.route.destination.name})`}>
              {zonesLabel(selected.zones?.destination)}
            </KeyValue>
            {isWholeCarBooked(selected) && (
              <KeyValue label="Band turi">
                <Badge size="sm">Butun mashina</Badge>
              </KeyValue>
            )}
            {selected.cancelReason && (
              <div className="col-span-2">
                <KeyValue label="Bekor qilish sababi">{selected.cancelReason}</KeyValue>
              </div>
            )}
            <div className="col-span-2 mt-2">
              <p className="mb-2 text-sm font-medium text-ink">Yoʻlovchilar</p>
              <TripBookings tripId={selected.id} refreshKey={bookingsRefreshKey} onChanged={load} />
            </div>
          </div>
        )}
      </Modal>
    </PageBody>
  );
}
