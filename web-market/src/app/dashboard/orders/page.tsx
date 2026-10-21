'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, Info } from 'lucide-react';
import { marketApi, MarketOrder, MarketOrderStatus } from '@/lib/api';
import { walletSwitchNotice } from '@/lib/vendor-settlement';
import type { VendorSettlementContext } from '@/lib/vendor-cash';
import { orderStatusMeta, compareOrders } from '@/lib/order-status';
import { errorMessage } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useVendorSettlement } from '@/hooks/useVendorSettlement';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { type TabItem } from '@/components/ui/Tabs';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/components/ui/cn';
import { OrderDrawer } from '@/components/orders/OrderDrawer';
import { ORDER_ROW_GRID, OrderCardMobile, OrderRow } from '@/components/orders/OrderRow';
import { usePageRefresh } from '@/components/shell';
import { t } from '@/locales';

type TabKey = 'all' | MarketOrderStatus;

const TAB_ORDER: TabKey[] = ['all', 'new', 'packing', 'shipped', 'delivered', 'cancelled'];

const POLL_INTERVAL_MS = 30_000;

export default function OrdersPage() {
  const m = t();
  const om = m.orders;
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<MarketOrder[]>(async () => {
    const res = await marketApi.getOrders();
    return res.data.data;
  });
  usePageRefresh(reload);

  // Buyurtma navbati — yuqori templi yuza: sahifaning o'zi ham 30 soniyada
  // jimgina yangilanadi (nav badge bilan bir xil ritmda). Oxirgi ma'lumot
  // ekranda qoladi, xato bo'lsa banner aytadi.
  useEffect(() => {
    const interval = setInterval(() => void reload(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);
  useRealtimeRefresh(reload);

  // Hisob-kitob rejimi (naqd / kuryer hamyoni) — ikkinchi darajali. O'tkazma
  // summalari buyurtmaning o'zidan (`vendorWalletSettlement`, o'tkazma paytidagi).
  const publicSettings = useVendorSettlement();
  const settlement: VendorSettlementContext = useMemo(
    () => ({ mode: publicSettings?.vendorSettlementMode }),
    [publicSettings]
  );
  const switchNotice = walletSwitchNotice(publicSettings);

  const orders = useMemo(() => [...(data ?? [])].sort(compareOrders), [data]);

  const filtered = useMemo(
    () => (tab === 'all' ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab]
  );

  const paged = usePagination(filtered, 25);

  const tabs: readonly TabItem<TabKey>[] = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return TAB_ORDER.map((value) => ({
      value,
      label: value === 'all' ? t().common.all : orderStatusMeta(value).label,
      count: counts[value] ?? 0,
    }));
  }, [orders]);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const selectedCount = selectedIds.length;
  const selectedNewCount = selectedIds.filter(
    (id) => orders.find((o) => o.id === id)?.status === 'new'
  ).length;
  const pageAllSelected = paged.pageItems.length > 0 && paged.pageItems.every((o) => selected[o.id]);

  const toggleAllOnPage = () => {
    const next = { ...selected };
    paged.pageItems.forEach((o) => (next[o.id] = !pageAllSelected));
    setSelected(next);
  };

  const bulkPack = async () => {
    setBusy(true);
    try {
      // Faqat `new` holatdagilar yig'ishga o'tadi; qolganlari tasodifan
      // bir bosqich oldinga surilib ketmasligi uchun o'tkazib yuboriladi.
      const targets = selectedIds
        .map((id) => orders.find((o) => o.id === id))
        .filter((o): o is MarketOrder => !!o && o.status === 'new');
      await Promise.all(targets.map((o) => marketApi.advanceOrder(o.id)));
      setSelected({});
      await reload();
      toast({ title: om.movedToPacking(targets.length), variant: 'success' });
    } catch (err) {
      toast({ title: m.common.error, description: errorMessage(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const advanceRow = async (o: MarketOrder) => {
    setAdvancingId(o.id);
    try {
      await marketApi.advanceOrder(o.id);
      await reload();
    } catch (err) {
      toast({ title: m.common.error, description: errorMessage(err), variant: 'error' });
    } finally {
      setAdvancingId(null);
    }
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  return (
    <div>
      <PageHeader
        title={om.title}
        description={om.description}
      />

      {switchNotice && (
        <p
          role="note"
          className="mb-3 flex items-start gap-2 rounded-ds-sm border border-info/30 bg-info-tint px-3 py-2 text-[13px] text-ink"
        >
          <Info size={14} aria-hidden className="mt-0.5 shrink-0 text-info-dark dark:text-info-light" />
          <span>
            {om.switchNotice(switchNotice)}
          </span>
        </p>
      )}

      {/* Holat zinapoyasi: Yangi → Yig'ilmoqda → Yuborildi → Yetkazildi. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SegmentedControl items={tabs} value={tab} onChange={setTab} ariaLabel={om.statusAria} />
      </div>

      {/* Tanlov paneli: soni + amal QAMROVI aniq yozilgan — "nima bo'ladi"
          tugma bosilmasidan oldin ma'lum. */}
      {selectedCount > 0 && (
        <div
          role="group"
          aria-label={om.selectionActions}
          className="mb-3 flex h-11 flex-wrap items-center gap-3 rounded-ds-md border border-line bg-surface px-4"
        >
          <span className="num text-[13px] font-medium text-ink">{om.selected(selectedCount)}</span>
          <span className="hidden text-[13px] text-muted sm:inline">
            {om.onlyNew(selectedNewCount)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              {m.common.cancel}
            </Button>
            <Button
              size="sm"
              isLoading={busy}
              disabled={selectedNewCount === 0}
              onClick={() => void bulkPack()}
              leftIcon={<Check size={14} aria-hidden />}
            >
              {om.toPacking(selectedNewCount)}
            </Button>
          </div>
        </div>
      )}

      {error && orders.length > 0 && (
        <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />
      )}

      {isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : error && orders.length === 0 ? (
        <ErrorState message={error} onRetry={reload} retrying={isRefreshing} />
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            variant="first-use"
            icon={<ClipboardList aria-hidden />}
            title={om.emptyTitle}
            description={om.emptyDescription}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          {tab === 'new' ? (
            <EmptyState
              variant="cleared"
              title={om.noNewTitle}
              description={om.noNewDescription}
            />
          ) : (
            <EmptyState
              variant="no-results"
              title={om.noInStatus(tab === 'all' ? m.common.all : orderStatusMeta(tab as MarketOrderStatus).label)}
              description={om.pickOther}
              onClearFilters={() => setTab('all')}
            />
          )}
        </Card>
      ) : (
        <>
          {/* Desktop: zich jadval. Sarlavha sahifa aylanishida yopishib turadi. */}
          <Card padding="none" className="hidden lg:block">
            <div
              className={cn(
                ORDER_ROW_GRID,
                'sticky top-0 z-10 h-9 rounded-t-ds-md border-b border-line bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted'
              )}
            >
              <Checkbox
                checked={pageAllSelected}
                onCheckedChange={toggleAllOnPage}
                aria-label={om.selectAllOnPage}
              />
              <span>{om.colCustomer}</span>
              <span className="text-right">{m.common.sum}</span>
              <span>{m.common.status}</span>
              <span>{om.colAction}</span>
            </div>
            <ul className="divide-y divide-divider">
              {paged.pageItems.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  checked={!!selected[o.id]}
                  onCheck={() => setSelected((s) => ({ ...s, [o.id]: !s[o.id] }))}
                  onOpen={() => setOpenOrderId(o.id)}
                  onAdvance={() => void advanceRow(o)}
                  advancing={advancingId === o.id}
                  settlementMode={settlement.mode}
                />
              ))}
            </ul>
            <Pagination paged={paged} />
          </Card>

          {/* Mobil: xuddi shu qatorlar karta ko'rinishida. */}
          <ul className="space-y-2 lg:hidden">
            {paged.pageItems.map((o) => (
              <li key={o.id}>
                <OrderCardMobile order={o} onOpen={() => setOpenOrderId(o.id)} settlementMode={settlement.mode} />
              </li>
            ))}
          </ul>
          <div className="mt-3 lg:hidden">
            <Card padding="none">
              <Pagination paged={paged} className="border-t-0" />
            </Card>
          </div>
        </>
      )}

      <OrderDrawer
        order={openOrder}
        onClose={() => setOpenOrderId(null)}
        onChanged={reload}
        onError={(msg) => toast({ title: m.common.error, description: msg, variant: 'error' })}
        settlement={settlement}
      />
    </div>
  );
}
