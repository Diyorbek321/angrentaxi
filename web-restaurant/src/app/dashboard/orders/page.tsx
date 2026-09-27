'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  Banknote,
  BellRing,
  ChefHat,
  ClipboardList,
  CreditCard,
  Inbox,
  MapPin,
  Maximize2,
  MessageSquareWarning,
  PackageCheck,
  Phone,
  Timer,
  Truck,
  User,
} from 'lucide-react';
import { clsx } from 'clsx';
import { foodApi, FoodOrder, FoodOrderStatus, Restaurant } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { money, formatTime } from '@/lib/utils';
import { ADVANCE_LABEL, NEXT_STATUS, statusMeta } from '@/lib/order-status';
import { trackNewOrders } from '@/lib/order-alerts';
import { useKiosk } from '@/lib/kiosk-context';
import { courierState, CourierTone } from '@/lib/courier';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PollStatus, StaleDataBanner } from '@/components/ui/PollStatus';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';

/**
 * Navbat OSHXONA HOLATI bo'yicha tablarga bo'linadi (Uber Eats naqshi):
 * Yangi / Tayyorlanmoqda / Tayyor — mavjud statuslarga 1:1 bog'lanadi,
 * yangi status O'YLAB TOPILMAYDI. Yetkazilgan va bekor qilinganlar bitta
 * "Yakunlangan" jurnal-tabida.
 */
type QueueTab = 'new' | 'preparing' | 'ready' | 'done';

const TAB_ORDER: ReadonlyArray<QueueTab> = ['new', 'preparing', 'ready', 'done'];

const TAB_LABEL: Record<QueueTab, string> = {
  new: 'Yangi',
  preparing: 'Tayyorlanmoqda',
  ready: 'Tayyor',
  done: 'Yakunlangan',
};

function tabOf(status: FoodOrderStatus): QueueTab {
  if (status === 'new' || status === 'preparing' || status === 'ready') return status;
  return 'done';
}

const REJECT_REASONS = [
  'Ingredientlar tugagan',
  'Oshxona band',
  'Ish vaqti tugadi',
  'Manzil yetkazib berish zonasidan tashqarida',
  'Boshqa sabab',
];

type Urgency = 'calm' | 'soon' | 'late';

interface Sla {
  text: string;
  urgency: Urgency;
  label: string;
}

/**
 * Qolgan tayyorlash vaqti — platforma ko'rayotgan soat. Ma'no faqat rang
 * bilan emas — yozuv va ikonka bilan ham beriladi.
 */
function slaInfo(order: FoodOrder, now: number): Sla | null {
  if (order.status !== 'new' && order.status !== 'preparing') return null;
  const prepSeconds = Math.max(...order.items.map((i) => i.prepMinutes), 1) * 60;
  const elapsed = (now - new Date(order.createdAt).getTime()) / 1000;
  const remaining = Math.round(prepSeconds - elapsed);
  const overdue = remaining < 0;
  const abs = Math.abs(remaining);
  const text = `${overdue ? '−' : ''}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;

  if (overdue) return { text, urgency: 'late', label: 'Kechikdi' };
  if (remaining <= 300) return { text, urgency: 'soon', label: 'Tugayapti' };
  return { text, urgency: 'calm', label: 'Vaqt bor' };
}

const slaClasses: Record<Urgency, string> = {
  calm: 'border-mint/45 bg-mint-tint text-primary-text',
  soon: 'border-override/45 bg-override-tint text-override-dark dark:text-override-light',
  late: 'border-danger/50 bg-danger-tint text-danger-deep dark:text-danger-light',
};

const byOldestFirst = (a: FoodOrder, b: FoodOrder) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

export default function OrdersPage() {
  const { toast } = useToast();
  const { kiosk, setKiosk } = useKiosk();
  const [tab, setTab] = useState<QueueTab>('new');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Ovoz sozlamasi restoran profilidan — bir marta yuklanadi, poll shart emas.
  const loadRestaurant = useCallback(async (): Promise<Restaurant> => {
    const res = await foodApi.getRestaurant();
    return res.data.data;
  }, []);
  const restaurantData = useAsyncData<Restaurant>(loadRestaurant);
  const soundOnRef = useRef(false);
  soundOnRef.current = restaurantData.data?.notifications.sound ?? false;

  const load = useCallback(async (): Promise<FoodOrder[]> => {
    const res = await foodApi.getOrders();
    const orders = res.data.data;
    // Signal POLL natijasidan otiladi (layoutning 30 s poll'i bilan dedup
    // modul ichida) — operator ekranga qaramasa ham eshitadi.
    trackNewOrders(orders, soundOnRef.current);
    return orders;
  }, []);

  const { data, status, error, isRefreshing, lastUpdatedAt, reload } = useAsyncData<FoodOrder[]>(load, {
    pollMs: 15000,
  });
  const orders = useMemo(() => data ?? [], [data]);

  // Taymer sekundlik — bu faqat ko'rsatkichni qayta chizadi, so'rov yubormaydi.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const grouped = useMemo(() => {
    const map: Record<QueueTab, FoodOrder[]> = { new: [], preparing: [], ready: [], done: [] };
    orders.forEach((o) => map[tabOf(o.status)].push(o));
    // Oshxona tablarida ENG ESKISI birinchi — e'tiborsiz qolgan eng qadimgi
    // buyurtma favqulodda holat. Jurnal (Yakunlangan) esa yangisi birinchi.
    map.new.sort(byOldestFirst);
    map.preparing.sort(byOldestFirst);
    map.ready.sort(byOldestFirst);
    map.done.sort((a, b) => byOldestFirst(b, a));
    return map;
  }, [orders]);

  const tabItems = useMemo(
    () =>
      TAB_ORDER.map((t) => ({
        value: t,
        label: TAB_LABEL[t],
        count: grouped[t].length,
      })),
    [grouped]
  );

  const advance = async (order: FoodOrder) => {
    setBusyId(order.id);
    try {
      if (order.status === 'new') await foodApi.acceptOrder(order.id);
      else await foodApi.advanceOrder(order.id);
      await reload();
      const next = NEXT_STATUS[order.status];
      toast({
        title: `#${order.id.slice(0, 6)} — ${next ? statusMeta(next).label : 'yangilandi'}`,
        variant: 'success',
      });
    } catch {
      toast({ title: 'Holatni o‘zgartirib bo‘lmadi', description: 'Qayta urinib ko‘ring', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const redispatch = async (order: FoodOrder) => {
    setBusyId(order.id);
    try {
      await foodApi.redispatchOrder(order.id);
      await reload();
      toast({ title: `#${order.id.slice(0, 6)} — kuryer qayta izlanmoqda`, variant: 'success' });
    } catch {
      toast({ title: 'Kuryerni chaqirib bo‘lmadi', description: 'Qayta urinib ko‘ring', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;
  const newCount = grouped.new.length;
  const visible = grouped[tab];

  return (
    <div className="flex h-full flex-col">
      {!kiosk && (
        <PageHeader
          title="Buyurtmalar"
          description="Oshxona navbati — har 15 soniyada yangilanadi"
          icon={<ClipboardList size={20} />}
          actions={
            <>
              <Badge variant={newCount > 0 ? 'info' : 'default'} dot={newCount > 0}>
                {newCount} ta yangi
              </Badge>
              <PollStatus lastUpdatedAt={lastUpdatedAt} isRefreshing={isRefreshing} onRefresh={reload} />
              <Button variant="secondary" leftIcon={<Maximize2 size={14} />} onClick={() => setKiosk(true)}>
                Oshxona ekrani
              </Button>
            </>
          }
        />
      )}

      {status === 'loading' && (
        <div className="flex flex-col gap-4">
          <div className="skeleton h-11 w-full max-w-md rounded-ds-sm" aria-hidden />
          <SkeletonCards count={6} height="h-64" columns />
          <span className="sr-only" role="status">
            Buyurtmalar yuklanmoqda
          </span>
        </div>
      )}

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Fon yangilanishi uzilsa — oxirgi yaxshi ma'lumot qoladi, banner belgilaydi. */}
          <StaleDataBanner error={error} lastUpdatedAt={lastUpdatedAt} onRetry={reload} isRetrying={isRefreshing} />

          <div className="flex flex-wrap items-center gap-3">
            <Tabs items={tabItems} value={tab} onChange={setTab} label="Oshxona holati bo'yicha navbat" />
            {kiosk && (
              <PollStatus
                lastUpdatedAt={lastUpdatedAt}
                isRefreshing={isRefreshing}
                onRefresh={reload}
                className="ml-auto"
              />
            )}
          </div>

          {orders.length === 0 ? (
            <EmptyState
              tone="positive"
              icon={<Inbox size={24} />}
              title="Hozircha buyurtma yo'q"
              description="Yangi buyurtma kelganda ovozli signal chalinadi, karta shu yerda paydo bo'ladi va yon menyuda hisoblanadi."
            />
          ) : visible.length === 0 ? (
            <QueueTabEmpty tab={tab} newCount={newCount} onGoToNew={() => setTab('new')} />
          ) : (
            <div
              className={clsx(
                'grid content-start overflow-y-auto pb-2',
                kiosk ? 'gap-5 md:grid-cols-2 2xl:grid-cols-3' : 'gap-4 sm:grid-cols-2 xl:grid-cols-3'
              )}
            >
              {visible.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  kiosk={kiosk}
                  now={now}
                  busy={busyId === order.id}
                  onOpen={() => setOpenOrderId(order.id)}
                  onAdvance={() => advance(order)}
                  onReject={() => setRejectId(order.id)}
                  onRedispatch={() => redispatch(order)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <OrderDrawer
        order={openOrder}
        busy={busyId != null}
        onClose={() => setOpenOrderId(null)}
        onAdvance={() => openOrder && advance(openOrder)}
        onReject={() => {
          if (!openOrder) return;
          setRejectId(openOrder.id);
          setOpenOrderId(null);
        }}
      />

      <RejectModal
        isOpen={rejectId != null}
        onClose={() => setRejectId(null)}
        onConfirm={async (reason) => {
          if (!rejectId) return;
          try {
            await foodApi.rejectOrder(rejectId, reason);
            toast({ title: 'Buyurtma rad etildi', description: reason, variant: 'info' });
          } catch {
            toast({ title: 'Rad etib bo‘lmadi', variant: 'error' });
          } finally {
            setRejectId(null);
            await reload();
          }
        }}
      />
    </div>
  );
}

/**
 * Tab bo'sh — bu uch xil holat: yangi navbat bo'shligi YAXSHI holat,
 * oshxona bo'shligi neytral, jurnal bo'shligi kunning boshlanishi.
 */
function QueueTabEmpty({
  tab,
  newCount,
  onGoToNew,
}: {
  tab: QueueTab;
  newCount: number;
  onGoToNew: () => void;
}) {
  if (tab === 'new') {
    return (
      <EmptyState
        tone="positive"
        icon={<BellRing size={24} />}
        title="Yangi buyurtma yo'q"
        description="Hammasi qabul qilingan. Yangisi kelganda signal chalinadi va shu tab hisoblagichi yonadi."
      />
    );
  }
  if (tab === 'preparing') {
    return (
      <EmptyState
        icon={<ChefHat size={24} />}
        title="Oshxonada buyurtma yo'q"
        description={
          newCount > 0
            ? `Yangi tabda ${newCount} ta buyurtma qabul kutmoqda.`
            : 'Yangi buyurtma qabul qilinganda u shu yerga tushadi.'
        }
        action={
          newCount > 0 ? (
            <Button variant="secondary" onClick={onGoToNew}>
              Yangi buyurtmalarga o&apos;tish
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (tab === 'ready') {
    return (
      <EmptyState
        icon={<PackageCheck size={24} />}
        title="Topshirishga tayyor buyurtma yo'q"
        description="«Tayyor deb belgilash» bosilgan buyurtmalar shu yerda kuryerni kutadi."
      />
    );
  }
  return (
    <EmptyState
      icon={<Inbox size={24} />}
      title="Yakunlangan buyurtma yo'q"
      description="Yetkazilgan va bekor qilingan buyurtmalar jurnali shu yerda ko'rinadi."
    />
  );
}

/**
 * Buyurtma kartasi oshxonaning savollariga BOSMASDAN javob beradi:
 * raqam, taomlar soni bilan, mijoz izohi (xatolarning №1 manbai — baland),
 * summa, to'lov turi. Holat zinapoyasi — har doim bir joyda turgan bitta
 * oldinga tugma.
 */
function OrderCard({
  order,
  kiosk,
  now,
  busy,
  onOpen,
  onAdvance,
  onReject,
  onRedispatch,
}: {
  order: FoodOrder;
  kiosk: boolean;
  now: number;
  busy: boolean;
  onOpen: () => void;
  onAdvance: () => void;
  onReject: () => void;
  onRedispatch: () => void;
}) {
  const sla = slaInfo(order, now);
  const canAdvance = NEXT_STATUS[order.status] != null;
  const isNew = order.status === 'new';
  const isDone = order.status === 'delivered' || order.status === 'cancelled';
  const phone = order.customerPhone ?? order.customer?.phone ?? null;
  const customerName =
    [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || 'Mijoz';

  return (
    <article
      aria-label={`Buyurtma №${order.id.slice(0, 6)}`}
      className={clsx(
        'flex flex-col rounded-ds-md border bg-surface shadow-card',
        kiosk ? 'p-5' : 'p-4',
        // Yangi buyurtma ko'zga tashlanadi: info halqa — o'tkazib yuborib bo'lmaydi.
        isNew ? 'border-info/50 ring-1 ring-info/40' : 'border-line'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className={clsx(
            'font-mono text-ink hover:text-primary-text transition-colors duration-fast min-h-touch inline-flex items-center',
            kiosk ? 'text-h2' : 'text-title'
          )}
        >
          #{order.id.slice(0, 6)}
          <span className="sr-only"> — tafsilotlarni ochish</span>
        </button>
        <span className="font-mono text-micro text-subtle tabular-nums">{formatTime(order.createdAt)}</span>
        {/* Tayyorlash taymeri — platforma ko'rayotgan soat, ko'rinarli joyda. */}
        {sla && (
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border',
              kiosk ? 'px-3 py-1.5 text-label' : 'px-2.5 py-1 text-caption',
              slaClasses[sla.urgency]
            )}
          >
            {sla.urgency === 'late' ? (
              <AlarmClock size={kiosk ? 16 : 13} aria-hidden />
            ) : (
              <Timer size={kiosk ? 16 : 13} aria-hidden />
            )}
            <span className="font-mono font-bold tabular-nums">{sla.text}</span>
            <span className="sr-only">{sla.label}</span>
          </span>
        )}
        {isDone && <OrderStatusBadge status={order.status} size="sm" />}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={clsx('inline-flex items-center gap-1.5 font-semibold text-ink', kiosk ? 'text-body-lg' : 'text-body')}>
          <User size={13} className="shrink-0 text-muted" aria-hidden />
          {customerName}
        </span>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 font-mono text-caption text-primary-text hover:underline underline-offset-4 min-h-touch"
          >
            <Phone size={12} aria-hidden />
            {phone}
          </a>
        )}
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
        <MapPin size={13} className="shrink-0" aria-hidden />
        <span className="truncate">{order.deliveryAddress}</span>
      </p>

      {/* Taomlar ro'yxati — oshxona bosmasdan ko'radi. */}
      <ul className={clsx('mt-3 flex flex-col gap-1 border-t border-divider pt-3', kiosk ? 'text-body-lg' : 'text-body')}>
        {order.items.map((it, i) => (
          <li key={`${it.dishId}-${i}`} className="flex items-baseline gap-2.5">
            <span className={clsx('shrink-0 font-mono font-bold text-primary-text tabular-nums', kiosk ? 'w-11' : 'w-9')}>
              {it.qty}×
            </span>
            <span className="min-w-0 flex-1 text-ink">{it.name}</span>
          </li>
        ))}
      </ul>

      {/* Mijoz izohi — xatolarning №1 manbai, shuning uchun BALAND. */}
      {order.note && (
        <div className="mt-3 rounded-ds-sm border border-override/45 bg-override-tint p-3">
          <p className="flex items-center gap-1.5 text-micro uppercase text-override-dark dark:text-override-light">
            <MessageSquareWarning size={13} aria-hidden />
            Mijoz izohi
          </p>
          <p className={clsx('mt-1 font-semibold text-ink', kiosk ? 'text-body-lg' : 'text-body')}>{order.note}</p>
        </div>
      )}

      {order.rejectReason && (
        <div className="mt-3 rounded-ds-sm border border-danger/40 bg-danger-tint p-3">
          <p className="text-micro uppercase text-danger-deep dark:text-danger-light">Rad etish sababi</p>
          <p className="mt-1 text-body text-ink">{order.rejectReason}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-divider pt-3">
        <span className="inline-flex items-center gap-1.5 text-caption text-muted">
          {order.paymentMethod === 'card' ? (
            <CreditCard size={13} aria-hidden />
          ) : (
            <Banknote size={13} aria-hidden />
          )}
          {order.paymentMethod === 'card' ? 'Karta' : 'Naqd'}
        </span>
        <span className={clsx('font-mono text-ink tabular-nums', kiosk ? 'text-h2' : 'text-title')}>
          {money(order.totalPrice)}
        </span>
      </div>

      {order.status === 'ready' && (
        <CourierStrip order={order} kiosk={kiosk} busy={busy} onRedispatch={onRedispatch} />
      )}

      {/* Holat zinapoyasi: BITTA oldinga tugma, har doim kartaning pastida. */}
      {canAdvance && (
        <div className="mt-3 flex gap-2">
          <Button
            size="kitchen"
            className={clsx('flex-1', kiosk && 'min-h-[56px] text-h3')}
            isLoading={busy}
            onClick={onAdvance}
          >
            {ADVANCE_LABEL[order.status]}
          </Button>
          {isNew && (
            <Button
              size="kitchen"
              variant="danger"
              className={clsx(kiosk && 'min-h-[56px]')}
              onClick={onReject}
              aria-label={`#${order.id.slice(0, 6)} buyurtmasini rad etish`}
            >
              Rad
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

const courierToneClasses: Record<CourierTone, string> = {
  waiting: 'border-info/40 bg-info-tint text-info-dark dark:text-info-light',
  active: 'border-mint-deep/40 bg-mint-tint text-primary-text',
  done: 'border-line bg-surface-2 text-muted',
  failed: 'border-danger/40 bg-danger-tint text-danger-dark dark:text-danger-light',
};

/**
 * Tayyor buyurtmaning kuryeri. "Kuryer topilmadi" — issiq ovqat kutib
 * turibdi va hech kim kelmaydi — shuning uchun qizil va tugma bilan:
 * oshxona boshqa oynani qidirmasdan shu yerdan qayta chaqiradi.
 */
function CourierStrip({
  order,
  kiosk,
  busy,
  onRedispatch,
}: {
  order: FoodOrder;
  kiosk: boolean;
  busy: boolean;
  onRedispatch: () => void;
}) {
  const state = courierState(order.delivery);
  const driver = order.delivery?.driverName;
  const driverPhone = order.delivery?.driverPhone;

  return (
    <div
      role="status"
      className={clsx('mt-3 rounded-ds-sm border p-3', courierToneClasses[state.tone])}
    >
      <p className={clsx('flex items-center gap-1.5 font-semibold', kiosk ? 'text-body-lg' : 'text-body')}>
        <Truck size={14} aria-hidden />
        {state.label}
      </p>
      {state.tone === 'active' && (driver || driverPhone) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-ink">
          {driver && <span>{driver}</span>}
          {driverPhone && (
            <a href={`tel:${driverPhone}`} className="inline-flex items-center gap-1 font-mono hover:underline min-h-touch">
              <Phone size={12} aria-hidden />
              {driverPhone}
            </a>
          )}
        </p>
      )}
      {state.canRedispatch && (
        <Button
          size="kitchen"
          variant="secondary"
          className={clsx('mt-2 w-full', kiosk && 'min-h-[56px] text-h3')}
          isLoading={busy}
          onClick={onRedispatch}
        >
          Kuryerni qayta chaqirish
        </Button>
      )}
    </div>
  );
}

function OrderDrawer({
  order,
  busy,
  onClose,
  onAdvance,
  onReject,
}: {
  order: FoodOrder | null;
  busy: boolean;
  onClose: () => void;
  onAdvance: () => void;
  onReject: () => void;
}) {
  if (!order) return null;
  const next = NEXT_STATUS[order.status];

  return (
    <Drawer
      isOpen
      onClose={onClose}
      width="md"
      title={`Buyurtma #${order.id.slice(0, 6)}`}
      subtitle={
        <span className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} size="sm" />
          <span className="font-mono text-micro text-subtle">{formatTime(order.createdAt)}</span>
        </span>
      }
      footer={
        (order.status === 'new' || next) && (
          <div className="flex gap-2">
            {order.status === 'new' && (
              <Button variant="danger" size="lg" onClick={onReject}>
                Rad etish
              </Button>
            )}
            {next && (
              <Button size="lg" className="flex-1" isLoading={busy} onClick={onAdvance}>
                {ADVANCE_LABEL[order.status]}
              </Button>
            )}
          </div>
        )
      }
    >
      <dl className="flex flex-col gap-2.5 text-body">
        <div className="flex items-center gap-2.5">
          <dt className="text-muted">
            <User size={16} aria-hidden />
            <span className="sr-only">Mijoz</span>
          </dt>
          <dd className="font-semibold text-ink">
            {[order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || 'Mijoz'}
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <dt className="text-muted">
            <Phone size={16} aria-hidden />
            <span className="sr-only">Telefon</span>
          </dt>
          <dd>
            <a
              href={`tel:${order.customerPhone ?? order.customer?.phone ?? ''}`}
              className="font-mono text-primary-text hover:underline underline-offset-4"
            >
              {order.customerPhone ?? order.customer?.phone ?? '—'}
            </a>
          </dd>
        </div>
        <div className="flex items-start gap-2.5">
          <dt className="text-muted mt-0.5">
            <MapPin size={16} aria-hidden />
            <span className="sr-only">Manzil</span>
          </dt>
          <dd className="text-ink">{order.deliveryAddress}</dd>
        </div>
      </dl>

      {order.note && (
        <div className="rounded-ds-sm border border-override/40 bg-override-tint p-3.5">
          <p className="flex items-center gap-1.5 text-micro uppercase text-override-dark dark:text-override-light">
            <MessageSquareWarning size={13} aria-hidden />
            Mijoz izohi
          </p>
          <p className="mt-1 text-body font-semibold text-ink">{order.note}</p>
        </div>
      )}

      {order.rejectReason && (
        <div className="rounded-ds-sm border border-danger/40 bg-danger-tint p-3.5">
          <p className="text-micro uppercase text-danger-deep dark:text-danger-light">Rad etish sababi</p>
          <p className="mt-1 text-body text-ink">{order.rejectReason}</p>
        </div>
      )}

      <div>
        <h3 className="text-micro uppercase text-subtle">Tarkibi</h3>
        <ul className="mt-2 divide-y divide-divider">
          {order.items.map((it, i) => (
            <li key={`${it.dishId}-${i}`} className="flex items-center gap-3 py-2.5">
              <span className="w-9 shrink-0 font-mono text-title text-primary-text tabular-nums">{it.qty}×</span>
              <span className="flex-1 text-body text-ink">{it.name}</span>
              <span className="font-mono text-body text-muted tabular-nums">{money(it.qty * it.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-body text-muted">
            To&apos;lov:{' '}
            <span className="font-semibold text-ink">
              {order.paymentMethod === 'card' ? 'Karta' : 'Naqd'}
            </span>
          </span>
          <span className="font-mono text-h2 text-ink tabular-nums">{money(order.totalPrice)}</span>
        </div>
      </div>
    </Drawer>
  );
}

function RejectModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      tone="danger"
      title="Buyurtmani rad etish"
      subtitle="Sababni tanlang — mijozga shu matn yuboriladi."
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            disabled={!reason}
            onClick={() => reason && onConfirm(reason)}
          >
            Rad etish
          </Button>
        </div>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Rad etish sababi</legend>
        {REJECT_REASONS.map((r) => (
          <label
            key={r}
            className={clsx(
              'flex cursor-pointer items-center gap-3 rounded-ds-sm border px-3.5 py-3 text-body transition-colors duration-fast min-h-touch',
              reason === r
                ? 'border-primary bg-mint-tint text-ink'
                : 'border-line bg-surface hover:bg-surface-2 text-muted'
            )}
          >
            <input
              type="radio"
              name="reject-reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="h-4 w-4 accent-[rgb(var(--primary-text))]"
            />
            <span className="font-semibold">{r}</span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
