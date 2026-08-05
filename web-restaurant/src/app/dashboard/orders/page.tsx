'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlarmClock, ClipboardList, Inbox, MapPin, Maximize2, Phone, Timer, User } from 'lucide-react';
import { clsx } from 'clsx';
import { foodApi, FoodOrder, FoodOrderStatus } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { money, formatTime } from '@/lib/utils';
import { ADVANCE_LABEL, NEXT_STATUS, statusMeta } from '@/lib/order-status';
import { useKiosk } from '@/lib/kiosk-context';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

const COLUMNS: ReadonlyArray<{ key: FoodOrderStatus; title: string }> = [
  { key: 'new', title: 'Yangi' },
  { key: 'preparing', title: 'Tayyorlanmoqda' },
  { key: 'ready', title: 'Tayyor · kuryer kutilmoqda' },
  { key: 'delivered', title: 'Yetkazildi' },
];

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
 * Qolgan tayyorlash vaqti. Ma'no faqat rang bilan emas — yozuv va ikonka
 * bilan ham beriladi ("Kechikdi" / "Tugayapti" / "Vaqt bor").
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

export default function OrdersPage() {
  const { toast } = useToast();
  const { kiosk, setKiosk } = useKiosk();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (): Promise<FoodOrder[]> => {
    const res = await foodApi.getOrders();
    return res.data.data;
  }, []);

  const { data, status, error, isRefreshing, reload } = useAsyncData<FoodOrder[]>(load, { pollMs: 15000 });
  const orders = useMemo(() => data ?? [], [data]);

  // Taymer sekundlik — bu faqat ko'rsatkichni qayta chizadi, so'rov yubormaydi.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const columns = useMemo(
    () => COLUMNS.map((c) => ({ ...c, orders: orders.filter((o) => o.status === c.key) })),
    [orders]
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

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;
  const newCount = columns[0]?.orders.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Buyurtmalar"
        description="Real vaqtli oqim — har 15 soniyada yangilanadi"
        icon={<ClipboardList size={20} />}
        actions={
          <>
            <Badge variant={newCount > 0 ? 'info' : 'default'} dot={newCount > 0}>
              {newCount} ta yangi
            </Badge>
            <Button variant="secondary" onClick={reload} isLoading={isRefreshing}>
              Yangilash
            </Button>
            {!kiosk && (
              <Button variant="secondary" leftIcon={<Maximize2 size={14} />} onClick={() => setKiosk(true)}>
                Oshxona ekrani
              </Button>
            )}
          </>
        }
      />

      {status === 'loading' && <SkeletonCards count={6} height="h-44" columns />}

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && orders.length === 0 && (
        <EmptyState
          tone="positive"
          icon={<Inbox size={24} />}
          title="Hozircha buyurtma yo'q"
          description="Yangi buyurtma kelganda u shu yerda paydo bo'ladi va yon menyuda hisoblanadi."
        />
      )}

      {status === 'ready' && orders.length > 0 && (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-2 items-start">
          {columns.map((col) => {
            const meta = statusMeta(col.key);
            return (
              <section
                key={col.key}
                aria-label={`${col.title} — ${col.orders.length} ta buyurtma`}
                className="flex w-[320px] shrink-0 max-h-full flex-col gap-3 rounded-ds-md border border-line bg-surface-2/60 p-3.5"
              >
                <h2 className="flex items-center gap-2 text-label text-ink">
                  <meta.Icon size={16} className="shrink-0 text-muted" aria-hidden />
                  <span className="flex-1">{col.title}</span>
                  <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-micro text-muted">
                    {col.orders.length}
                  </span>
                </h2>

                <div className="flex flex-col gap-3 overflow-y-auto">
                  {col.orders.length === 0 && (
                    <p className="rounded-ds-sm border border-dashed border-line px-3 py-6 text-center text-caption text-subtle">
                      Bo&apos;sh
                    </p>
                  )}

                  {col.orders.map((order) => {
                    const sla = slaInfo(order, now);
                    const itemsCount = order.items.reduce((s, i) => s + i.qty, 0);
                    const canAdvance = NEXT_STATUS[order.status] != null;
                    return (
                      <article
                        key={order.id}
                        className="rounded-ds-md border border-line bg-surface p-3.5 shadow-card"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenOrderId(order.id)}
                            className="font-mono text-title text-ink hover:text-primary-text transition-colors duration-fast"
                          >
                            #{order.id.slice(0, 6)}
                            <span className="sr-only"> — tafsilotlarni ochish</span>
                          </button>
                          {sla && (
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro',
                                slaClasses[sla.urgency]
                              )}
                            >
                              {sla.urgency === 'late' ? (
                                <AlarmClock size={13} aria-hidden />
                              ) : (
                                <Timer size={13} aria-hidden />
                              )}
                              <span className="font-mono tabular-nums">{sla.text}</span>
                              <span className="sr-only">{sla.label}</span>
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-body font-semibold text-ink truncate">
                          {[order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') ||
                            order.customerPhone ||
                            'Mijoz'}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-caption text-muted">
                          <MapPin size={13} className="shrink-0" aria-hidden />
                          <span className="truncate">{order.deliveryAddress}</span>
                        </p>

                        <div className="mt-3 flex items-center justify-between border-t border-divider pt-3">
                          <span className="text-caption text-muted">{itemsCount} ta taom</span>
                          <span className="font-mono text-title text-ink tabular-nums">
                            {money(order.totalPrice)}
                          </span>
                        </div>

                        {order.status === 'new' && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="kitchen"
                              className="flex-1"
                              isLoading={busyId === order.id}
                              onClick={() => advance(order)}
                            >
                              Qabul qilish
                            </Button>
                            <Button
                              size="kitchen"
                              variant="danger"
                              onClick={() => setRejectId(order.id)}
                              aria-label={`#${order.id.slice(0, 6)} buyurtmasini rad etish`}
                            >
                              Rad
                            </Button>
                          </div>
                        )}

                        {order.status !== 'new' && canAdvance && (
                          <Button
                            size="kitchen"
                            fullWidth
                            className="mt-3"
                            isLoading={busyId === order.id}
                            onClick={() => advance(order)}
                          >
                            {ADVANCE_LABEL[order.status]}
                          </Button>
                        )}

                        {order.status === 'delivered' && (
                          <div className="mt-3">
                            <OrderStatusBadge status={order.status} size="sm" />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {error && status === 'ready' && (
        <p role="status" className="mt-3 text-caption text-override-dark dark:text-override-light">
          Oxirgi yangilash muvaffaqiyatsiz: {error}
        </p>
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
          <p className="text-micro uppercase text-override-dark dark:text-override-light">Maxsus izoh</p>
          <p className="mt-1 text-body text-ink">{order.note}</p>
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
