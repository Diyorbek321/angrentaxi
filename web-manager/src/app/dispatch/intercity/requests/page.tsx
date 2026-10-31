'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { KeyValue } from '@/components/ui/KeyValue';
import { Modal } from '@/components/ui/Modal';
import { PageBody } from '@/components/ui/PageBody';
import { PageHeader } from '@/components/ui/PageHeader';
import { PollStatus } from '@/components/ui/PollStatus';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Select } from '@/components/ui/Select';
import { formatMoney, formatPhone } from '@/lib/format';
import { tripClassLabel } from '@/lib/intercity';
import { getIntercityRequests } from '@/lib/intercity-api';
import {
  INTERCITY_REQUEST_STATUSES,
  INTERCITY_REQUEST_STATUS_BADGE,
  intercityRequestStatusLabels,
  formatRequestWindow,
  requestKindLabel,
  requestRouteName,
  type IntercityRequestManage,
  type IntercityRequestPage,
  type IntercityRequestStatus,
} from '@/lib/intercity-requests';
import { SOCKET_EVENTS, subscribeToSocket } from '@/lib/socket';
import { t } from '@/locales';

const PAGE_SIZE = 50;

/** Socket asosiy manba; sekin so'rov — uzilish paytida o'tkazib yuborilganlar uchun. */
const FALLBACK_POLL_MS = 60_000;

/**
 * Ketma-ket hodisalar (har "+" bosish — bitta `updated`) bitta yuklashga
 * yig'iladi: so'rov arzon, lekin har bosishga bittadan bo'lishi shart emas.
 */
const SOCKET_RELOAD_DEBOUNCE_MS = 500;

function statusOptions() {
  return [
    { value: '', label: t().control.requests.allStatuses },
    ...INTERCITY_REQUEST_STATUSES.map((status) => ({ value: status, label: intercityRequestStatusLabels()[status] })),
  ];
}

/**
 * Dispetcher: mos qatnov topmagan yo'lovchilarning so'rovlari. Ochiq so'rov
 * uzoq turib qolsa dispetcher yo'lovchiga qo'ng'iroq qiladi yoki
 * haydovchilarga aytadi — qabul qilish faqat haydovchi ilovasida.
 */
export default function IntercityRequestsPage() {
  const mr = t().control.requests;
  // Standart — ochiqlar: dispetcherga kerakli ish shular.
  const [status, setStatus] = useState<IntercityRequestStatus | ''>('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IntercityRequestPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [selected, setSelected] = useState<IntercityRequestManage | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setIsLoading(true);
    try {
      const result = await getIntercityRequests({ status: status || undefined, page, limit: PAGE_SIZE });
      // Filtr tez almashtirilsa eski javob yangisining ustiga yozilmasin.
      if (seq !== loadSeq.current) return;
      setData(result);
      setError(null);
      setLastUpdatedAt(Date.now());
      setSelected((prev) => (prev ? (result.items.find((r) => r.id === prev.id) ?? prev) : prev));
    } catch {
      if (seq === loadSeq.current) setError(t().control.requests.loadFailed);
    } finally {
      if (seq === loadSeq.current) setIsLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), SOCKET_RELOAD_DEBOUNCE_MS);
    };
    const events = [
      SOCKET_EVENTS.INTERCITY_REQUEST_CREATED,
      SOCKET_EVENTS.INTERCITY_REQUEST_UPDATED,
      SOCKET_EVENTS.INTERCITY_REQUEST_CLOSED,
    ];
    const unsubscribe = subscribeToSocket((socket) => {
      for (const event of events) socket.on(event, reload);
      return () => {
        for (const event of events) socket.off(event, reload);
      };
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [load]);

  const columns: DataTableColumn<IntercityRequestManage>[] = [
    {
      key: 'window',
      header: mr.window,
      className: 'num whitespace-nowrap',
      cell: (r) => <span className="font-medium text-ink">{formatRequestWindow(r.windowStart, r.windowEnd)}</span>,
    },
    {
      key: 'route',
      header: mr.route,
      cell: (r) => <span className="text-ink">{requestRouteName(r)}</span>,
    },
    {
      key: 'what',
      header: mr.what,
      hideBelow: 'md',
      cell: (r) => `${requestKindLabel(r)} · ${tripClassLabel(r.tripClass)}`,
    },
    {
      key: 'passenger',
      header: mr.passenger,
      hideBelow: 'lg',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{r.passengerName ?? mr.passenger}</p>
          <p className="num truncate text-xs text-muted">{formatPhone(r.passengerPhone)}</p>
        </div>
      ),
    },
    {
      key: 'price',
      header: mr.price,
      numeric: true,
      cell: (r) => (
        <div className="text-right">
          <p className="num text-ink">{formatMoney(r.total)}</p>
          {r.bonus > 0 && <p className="num text-xs text-muted">{mr.raised(formatMoney(r.bonus, { signed: true }))}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: mr.status,
      cell: (r) => (
        <Badge variant={INTERCITY_REQUEST_STATUS_BADGE[r.status]} size="sm" dot>
          {intercityRequestStatusLabels()[r.status]}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: mr.created,
      hideBelow: 'lg',
      cell: (r) => <RelativeTime value={r.createdAt} className="text-muted" />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{mr.actions}</span>,
      align: 'right',
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(r);
          }}
        >
          {mr.details}
        </Button>
      ),
    },
  ];

  const rows = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <PageBody>
      <PageHeader
        title={mr.title}
        description={
          data
            ? `${mr.count(data.total)}${status ? ` · ${intercityRequestStatusLabels()[status].toLowerCase()}` : ''}`
            : mr.description
        }
        actions={
          <PollStatus lastUpdatedAt={lastUpdatedAt} isRefreshing={isLoading} onRefresh={load} error={error} />
        }
      />

      <DataTable
        ariaLabel={mr.title}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading && !data}
        error={error}
        onRetry={load}
        onRowClick={setSelected}
        rowClassName={(r) => (r.status === 'open' ? undefined : 'text-muted')}
        isFiltered={status !== ''}
        onClearFilters={() => {
          setStatus('');
          setPage(1);
        }}
        empty={{
          title: status === 'open' ? mr.emptyOpen : mr.empty,
          description: mr.emptyDescription,
        }}
        toolbar={
          <FilterBar>
            <Select
              size="sm"
              aria-label={mr.statusAria}
              options={statusOptions()}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as IntercityRequestStatus | '');
                setPage(1);
              }}
              wrapperClassName="w-56"
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
        title={selected ? requestRouteName(selected) : ''}
        subtitle={selected ? formatRequestWindow(selected.windowStart, selected.windowEnd) : undefined}
        size="lg"
      >
        {selected && <RequestDetails request={selected} />}
      </Modal>
    </PageBody>
  );
}

function RequestDetails({ request }: { request: IntercityRequestManage }) {
  const mr = t().control.requests;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <KeyValue label={mr.status}>
        <Badge variant={INTERCITY_REQUEST_STATUS_BADGE[request.status]} size="sm" dot>
          {intercityRequestStatusLabels()[request.status]}
        </Badge>
      </KeyValue>
      <KeyValue label={mr.what}>
        {requestKindLabel(request)} · {tripClassLabel(request.tripClass)}
      </KeyValue>
      <KeyValue label={mr.passenger}>{request.passengerName ?? '—'}</KeyValue>
      <KeyValue label={mr.phone}>
        {request.passengerPhone ? (
          <a href={`tel:${request.passengerPhone}`} className="num hover:underline">
            {formatPhone(request.passengerPhone)}
          </a>
        ) : (
          '—'
        )}
      </KeyValue>
      <KeyValue label={mr.pickupAddress}>{request.pickup.address || '—'}</KeyValue>
      <KeyValue label={mr.dropoffAddress}>{request.dropoff.address || '—'}</KeyValue>
      <KeyValue label={mr.basePrice}>
        <span className="num">{formatMoney(request.basePrice)}</span>
      </KeyValue>
      <KeyValue label={mr.passengerBonus}>
        <span className="num">{request.bonus > 0 ? formatMoney(request.bonus, { signed: true }) : '—'}</span>
      </KeyValue>
      <KeyValue label={mr.total}>
        <span className="num font-medium text-ink">{formatMoney(request.total)}</span>
      </KeyValue>
      <KeyValue label={mr.created}>
        <RelativeTime value={request.createdAt} />
      </KeyValue>
      {request.status === 'accepted' && (
        <div className="col-span-2">
          <KeyValue label={mr.result}>
            {mr.acceptedResult}
          </KeyValue>
        </div>
      )}
    </div>
  );
}
