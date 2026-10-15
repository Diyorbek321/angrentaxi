'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, Pencil, Shield, ShieldOff, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { DetailCard, KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { PlateNumber } from '@/components/ui/PlateNumber';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { DriverStatusBadge } from '@/components/drivers/DriverStatusBadge';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { driversApi, settingsApi, Driver, DriverTrip } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { driverRegisteredAt } from '@/lib/driver';
import {
  formatDateShort,
  formatDateTime,
  formatNumber,
  formatPhone,
  formatRating,
  fullName,
} from '@/lib/format';

type ActionType = 'approve' | 'block' | 'unblock' | 'addFunds' | 'commissionRate';

const ACTION_TITLES: Record<ActionType, string> = {
  approve: 'Haydovchini tasdiqlash',
  block: 'Haydovchini bloklash',
  unblock: 'Blokdan chiqarish',
  addFunds: "Hisobni to'ldirish",
  commissionRate: 'Komissiya foizini belgilash',
};

const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  approve: 'Bu haydovchi tizimda ishlash huquqini oladi. Tasdiqlaysizmi?',
  block: "Bu haydovchi tizimdan bloklanadi. Ishlashni to'xtatadi.",
  unblock: "Bu haydovchi yana tizimda ishlash imkoniyatiga ega bo'ladi.",
  addFunds: "Musbat miqdor balansni to'ldiradi, manfiy miqdor ushlab qoladi (masalan, tuzatish uchun).",
  commissionRate:
    "Ushbu haydovchi uchun alohida komissiya foizi (masalan, reklama tashigani uchun kamroq). Bo'sh qoldirsangiz, standart foiz qo'llanadi.",
};

const tripColumns: DataTableColumn<DriverTrip>[] = [
  {
    key: 'route',
    header: "Yo'nalish",
    cell: (t) => (
      <div className="min-w-0 max-w-[320px]">
        <p className="truncate text-ink">{t.pickupAddress ?? '—'}</p>
        <p className="truncate text-xs text-muted">{t.dropoffAddress ?? '—'}</p>
      </div>
    ),
  },
  { key: 'price', header: 'Narx', numeric: true, cell: (t) => <MoneyText value={t.finalPrice ?? t.estimatedPrice} /> },
  { key: 'status', header: 'Holat', cell: (t) => <OrderStatusBadge status={t.status} /> },
  {
    key: 'date',
    header: 'Sana',
    className: 'num whitespace-nowrap text-muted',
    cell: (t) => formatDateTime(t.createdAt, { withYear: true }),
  },
];

export default function DriverDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const driverId = params.id as string;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [fundsAmount, setFundsAmount] = useState('');
  const [fundsNote, setFundsNote] = useState('');
  const [commissionInput, setCommissionInput] = useState('');
  const [defaultCommissionRate, setDefaultCommissionRate] = useState<number | null>(null);

  const tripsPagination = usePagination(10);

  const fetchDriver = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await driversApi.getById(driverId);
      setDriver(res.data.data);
      setLoadError(null);
    } catch {
      setLoadError("Haydovchi ma'lumotlarini yuklashda xatolik");
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    void fetchDriver();
  }, [fetchDriver]);

  useEffect(() => {
    settingsApi.getCommission()
      .then((res) => setDefaultCommissionRate(res.data.data.defaultCommissionRate))
      .catch(() => {});
  }, []);

  const fetchTrips = async () => {
    if (!driver) return;
    setTripsLoading(true);
    setTripsError(null);
    try {
      const res = await driversApi.getTrips(driverId, {
        page: tripsPagination.page,
        limit: tripsPagination.limit,
      });
      const payload = res.data.data;
      setTrips(payload?.orders ?? []);
      const total = payload?.total ?? 0;
      tripsPagination.setTotal(total, Math.ceil(total / tripsPagination.limit));
    } catch {
      setTripsError('Safarlarni yuklashda xatolik');
      toast({ title: 'Xatolik', description: 'Safarlarni yuklashda xatolik', variant: 'error' });
    } finally {
      setTripsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, tripsPagination.page]);

  const handleAction = async () => {
    if (!driver || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        const res = await driversApi.approve(driver.id);
        setDriver(prev => prev ? { ...prev, ...(res.data.data as Partial<Driver>) } : null);
        toast({ title: 'Haydovchi tasdiqlandi', variant: 'success' });
      } else if (actionType === 'block') {
        await driversApi.block(driver.userId, blockReason.trim() || undefined);
        setDriver(prev => prev ? { ...prev, status: 'blocked', blockReason: blockReason.trim() || null } : null);
        toast({ title: 'Haydovchi bloklandi', variant: 'success' });
      } else if (actionType === 'unblock') {
        await driversApi.unblock(driver.userId);
        setDriver(prev => prev ? { ...prev, status: 'active', blockReason: null } : null);
        toast({ title: 'Haydovchi blokdan chiqarildi', variant: 'success' });
      } else if (actionType === 'addFunds') {
        const amount = parseFloat(fundsAmount);
        if (!amount) {
          toast({ title: 'Xatolik', description: 'Miqdorni kiriting', variant: 'error' });
          return;
        }
        const res = await driversApi.addFunds(driver.id, amount, fundsNote.trim() || undefined);
        setDriver(prev => prev ? { ...prev, ...(res.data.data as Partial<Driver>) } : null);
        toast({ title: 'Balans yangilandi', variant: 'success' });
      } else if (actionType === 'commissionRate') {
        const trimmed = commissionInput.trim();
        const rate = trimmed === '' ? null : parseFloat(trimmed);
        const res = await driversApi.setCommissionRate(driver.id, rate);
        setDriver(prev => prev ? { ...prev, ...(res.data.data as Partial<Driver>) } : null);
        toast({ title: 'Komissiya foizi yangilandi', variant: 'success' });
      }
    } catch {
      toast({ title: 'Xatolik', description: 'Amalni bajarishda xatolik', variant: 'error' });
    } finally {
      setActionLoading(false);
      setActionType(null);
      setBlockReason('');
      setFundsAmount('');
      setFundsNote('');
      setCommissionInput('');
    }
  };

  const closeModal = () => {
    setActionType(null);
    setBlockReason('');
    setFundsAmount('');
    setFundsNote('');
    setCommissionInput('');
  };

  const crumbsBase = { label: 'Haydovchilar', href: '/dashboard/drivers' };

  if (isLoading && !driver) {
    return (
      <div className="px-4 sm:px-6 py-5" aria-busy="true">
        <Skeleton className="h-3 w-40 mb-2" />
        <Skeleton className="h-6 w-56 mb-5" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-ds-md" />
            <Skeleton className="h-32 rounded-ds-md" />
          </div>
          <SkeletonTable rows={8} cols={4} className="lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="px-4 sm:px-6 py-5">
        <PageHeader title="Haydovchi" breadcrumbs={[crumbsBase, { label: 'Topilmadi' }]} />
        <Card padding="none">
          <ErrorState message={loadError} onRetry={fetchDriver} />
        </Card>
      </div>
    );
  }

  const name = fullName(driver.firstName, driver.lastName);
  const debt = (driver.walletBalance ?? 0) < 0;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        breadcrumbs={[crumbsBase, { label: name }]}
        title={name}
        meta={
          <span className="inline-flex flex-wrap items-center gap-2">
            <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
            <span className="num">{formatPhone(driver.phone)}</span>
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setActionType('addFunds')}
              leftIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}
            >
              Hisobni to&apos;ldirish
            </Button>
            {driver.status !== 'blocked' ? (
              <Button
                variant="danger-ghost"
                onClick={() => setActionType('block')}
                leftIcon={<ShieldOff className="h-4 w-4" aria-hidden="true" />}
              >
                Bloklash
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setActionType('unblock')}
                leftIcon={<Shield className="h-4 w-4" aria-hidden="true" />}
              >
                Blokdan chiqarish
              </Button>
            )}
            {driver.status === 'pending' && (
              <Button
                variant="primary"
                onClick={() => setActionType('approve')}
                leftIcon={<CheckCircle className="h-4 w-4" aria-hidden="true" />}
              >
                Tasdiqlash
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 items-start">
        <div className="space-y-4">
          <DetailCard title="Profil">
            <KeyValueList>
                <KeyValue label="Telefon">
                  <span className="num">{formatPhone(driver.phone)}</span>
                </KeyValue>
                <KeyValue label="Avtomobil">
                  {driver.carModel || '—'}
                  {driver.carColor ? ` · ${driver.carColor}` : ''}
                </KeyValue>
                <KeyValue label="Davlat raqami">
                  <PlateNumber plate={driver.carNumber} />
                </KeyValue>
                {driver.licenseNumber && (
                  <KeyValue label="Guvohnoma">
                    <span className="font-mono text-xs">{driver.licenseNumber}</span>
                  </KeyValue>
                )}
                <KeyValue label="Reyting">
                  <span className="num">{formatRating(driver.rating)}</span>
                </KeyValue>
                <KeyValue label="Safarlar">
                  <span className="num">{formatNumber(driver.totalTrips)}</span>
                </KeyValue>
                <KeyValue label="Ro'yxatdan o'tgan">
                  <span className="num">{formatDateShort(driverRegisteredAt(driver))}</span>
                </KeyValue>
                {driver.status === 'blocked' && (
                  <KeyValue label="Blok sababi">
                    <span className="text-danger-dark dark:text-danger-light">{driver.blockReason || '—'}</span>
                  </KeyValue>
                )}
            </KeyValueList>
          </DetailCard>

          <DetailCard title="Moliya">
            <KeyValueList>
                {/* Manba — DAFTAR (`walletBalance`), `balance` ustuni EMAS. */}
                <KeyValue label={debt ? 'Qarz' : 'Hamyon'}>
                  {driver.walletBalance !== undefined ? (
                    <MoneyText value={driver.walletBalance} signed className="font-semibold" />
                  ) : (
                    '—'
                  )}
                </KeyValue>
                <KeyValue label="Komissiya">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="num">
                      {driver.commissionRate != null
                        ? `${driver.commissionRate}%`
                        : defaultCommissionRate != null
                          ? `Standart (${defaultCommissionRate}%)`
                          : 'Standart'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Komissiya foizini o'zgartirish"
                      onClick={() => {
                        setCommissionInput(driver.commissionRate != null ? String(driver.commissionRate) : '');
                        setActionType('commissionRate');
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </span>
                </KeyValue>
            </KeyValueList>
          </DetailCard>
        </div>

        <DataTable
          title="Safarlar tarixi"
          className="lg:col-span-2"
          ariaLabel="Safarlar tarixi"
          columns={tripColumns}
          rows={trips}
          rowKey={(t) => t.id}
          loading={tripsLoading}
          error={tripsError}
          onRetry={fetchTrips}
          empty={{ title: "Safarlar yo'q", description: 'Haydovchi hali safar qilmagan.' }}
          pagination={{
            page: tripsPagination.page,
            totalPages: tripsPagination.totalPages,
            total: tripsPagination.total,
            limit: tripsPagination.limit,
            pageRange: tripsPagination.pageRange,
            canGoPrev: tripsPagination.canGoPrev,
            canGoNext: tripsPagination.canGoNext,
            onPageChange: tripsPagination.goToPage,
          }}
        />
      </div>

      <Modal
        isOpen={!!actionType}
        onClose={closeModal}
        title={actionType ? ACTION_TITLES[actionType] : undefined}
        description={actionType ? ACTION_DESCRIPTIONS[actionType] : undefined}
        tone={actionType === 'block' ? 'danger' : 'default'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={actionLoading}>
              Bekor qilish
            </Button>
            <Button
              variant={actionType === 'block' ? 'danger' : 'primary'}
              isLoading={actionLoading}
              onClick={handleAction}
            >
              Tasdiqlash
            </Button>
          </>
        }
      >
        {actionType === 'block' && (
          <Input
            label="Sabab (ixtiyoriy)"
            placeholder="Masalan: qoidabuzarlik, shikoyatlar..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
        )}
        {actionType === 'addFunds' && (
          <div className="space-y-3">
            <Input
              label="Miqdor (so'm)"
              type="number"
              placeholder="Masalan: 50000 yoki -10000"
              value={fundsAmount}
              onChange={(e) => setFundsAmount(e.target.value)}
            />
            <Input
              label="Izoh (ixtiyoriy)"
              placeholder="Masalan: naqd pul orqali to'ldirildi"
              value={fundsNote}
              onChange={(e) => setFundsNote(e.target.value)}
            />
          </div>
        )}
        {actionType === 'commissionRate' && (
          <Input
            label={`Komissiya foizi, % (standart: ${defaultCommissionRate ?? '—'}%)`}
            type="number"
            placeholder="Bo'sh — standart foiz qo'llanadi"
            value={commissionInput}
            onChange={(e) => setCommissionInput(e.target.value)}
          />
        )}
      </Modal>
    </div>
  );
}
