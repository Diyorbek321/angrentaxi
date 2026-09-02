'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, MarketOrder, MarketOrderStatus } from '@/lib/api';
import { ORDER_STATUS, compareOrders } from '@/lib/order-status';
import { errorMessage } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
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
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { OrderDrawer } from '@/components/orders/OrderDrawer';
import { ORDER_ROW_GRID, OrderCardMobile, OrderRow } from '@/components/orders/OrderRow';

type TabKey = 'all' | MarketOrderStatus;

const TAB_ORDER: TabKey[] = ['all', 'new', 'packing', 'shipped', 'delivered', 'cancelled'];

const POLL_INTERVAL_MS = 30_000;

export default function OrdersPage() {
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

  // Buyurtma navbati — yuqori templi yuza: sahifaning o'zi ham 30 soniyada
  // jimgina yangilanadi (nav badge bilan bir xil ritmda). Oxirgi ma'lumot
  // ekranda qoladi, xato bo'lsa banner aytadi.
  useEffect(() => {
    const interval = setInterval(() => void reload(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);

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
      label: value === 'all' ? 'Barchasi' : ORDER_STATUS[value].label,
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
      toast({ title: `${targets.length} ta buyurtma yig'ishga o'tkazildi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
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
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setAdvancingId(null);
    }
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  return (
    <div>
      <PageHeader
        title="Buyurtmalar"
        description="Yangi va faol buyurtmalar navbati"
        icon={<ClipboardList size={18} aria-hidden />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void reload()}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={13} aria-hidden />}
          >
            Yangilash
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs items={tabs} value={tab} onChange={setTab} size="sm" />
      </div>

      {/* Tanlov paneli: soni + amal QAMROVI aniq yozilgan — "nima bo'ladi"
          tugma bosilmasidan oldin ma'lum. */}
      {selectedCount > 0 && (
        <div
          role="group"
          aria-label="Tanlanganlar uchun amallar"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-ds-sm border border-mint/30 bg-mint-tint px-3.5 py-2"
        >
          <span className="text-caption font-bold text-primary-text">
            {selectedCount} ta tanlandi
          </span>
          <span className="text-caption text-muted">
            Faqat «Yangi» holatdagilar o&apos;tkaziladi — {selectedNewCount} ta
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelected({})}>
              Bekor qilish
            </Button>
            <Button
              size="sm"
              isLoading={busy}
              disabled={selectedNewCount === 0}
              onClick={() => void bulkPack()}
              leftIcon={<Check size={14} aria-hidden />}
            >
              Yig&apos;ishga o&apos;tkazish ({selectedNewCount})
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
        <ErrorState message={error} onRetry={reload} />
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={24} aria-hidden />}
            title="Hali buyurtma yo'q"
            description="Mijoz birinchi buyurtma berganida u shu yerda, navbatning eng tepasida ko'rinadi."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          {tab === 'new' ? (
            <EmptyState
              tone="positive"
              title="Yangi buyurtma yo'q — hammasi qabul qilingan"
              description="Yangi buyurtma kelishi bilan shu yerda va tab sarlavhasida ko'rinadi."
            />
          ) : (
            <EmptyState
              title={`«${tab === 'all' ? 'Barchasi' : ORDER_STATUS[tab as MarketOrderStatus].label}» holatida buyurtma yo'q`}
              description="Boshqa holatni tanlang yoki filtrni tozalang."
              action={
                <Button size="sm" variant="secondary" onClick={() => setTab('all')}>
                  Barchasini ko&apos;rsatish
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <>
          {/* Desktop: zich jadval. Sarlavha sahifa aylanishida yopishib turadi. */}
          <Card padding="none" className="hidden lg:block">
            <div
              className={clsx(
                ORDER_ROW_GRID,
                'sticky top-14 z-20 rounded-t-ds-md border-b border-line bg-surface-2 px-4 py-2.5 text-micro uppercase text-muted'
              )}
            >
              <span>
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleAllOnPage}
                  aria-label="Sahifadagi hammasini tanlash"
                  className="h-4 w-4 accent-brand"
                />
              </span>
              <span>Mijoz / buyurtma</span>
              <span className="text-right">Summa</span>
              <span>Holat</span>
              <span>Amal</span>
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
                />
              ))}
            </ul>
            <Pagination paged={paged} />
          </Card>

          {/* Mobil: xuddi shu qatorlar karta ko'rinishida. */}
          <ul className="space-y-2.5 lg:hidden">
            {paged.pageItems.map((o) => (
              <li key={o.id}>
                <OrderCardMobile order={o} onOpen={() => setOpenOrderId(o.id)} />
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
        onError={(msg) => toast({ title: 'Xatolik', description: msg, variant: 'error' })}
      />
    </div>
  );
}
