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
import { DriverLegalCard } from '@/components/drivers/DriverLegalCard';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { driversApi, settingsApi, Driver, DriverTrip } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { driverRegisteredAt } from '@/lib/driver';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { balanceAdjustmentErrorMessage, validateBalanceAdjustment } from '@/lib/balance-adjustment';
import {
  formatDateShort,
  formatDateTime,
  formatNumber,
  formatPhone,
  formatRating,
  fullName,
} from '@/lib/format';
import { t } from '@/locales';

type ActionType = 'approve' | 'block' | 'unblock' | 'addFunds' | 'commissionRate';

function buildTripColumns(): DataTableColumn<DriverTrip>[] {
  const m = t().drivers.detail.trips;
  return [
    {
      key: 'route',
      header: m.route,
      cell: (t) => (
        <div className="min-w-0 max-w-[320px]">
          <p className="truncate text-ink">{t.pickupAddress ?? '—'}</p>
          <p className="truncate text-xs text-muted">{t.dropoffAddress ?? '—'}</p>
        </div>
      ),
    },
    { key: 'price', header: m.price, numeric: true, cell: (t) => <MoneyText value={t.finalPrice ?? t.estimatedPrice} /> },
    { key: 'status', header: m.status, cell: (t) => <OrderStatusBadge status={t.status} /> },
    {
      key: 'date',
      header: m.date,
      className: 'num whitespace-nowrap text-muted',
      cell: (t) => formatDateTime(t.createdAt, { withYear: true }),
    },
  ];
}

export default function DriverDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const driverId = params.id as string;
  const m = t().drivers.detail;
  const mc = t().common;

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
      setLoadError(m.loadError);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setTripsError(m.tripsLoadError);
      toast({ title: mc.error, description: m.tripsLoadError, variant: 'error' });
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
        toast({ title: m.toast.approved, variant: 'success' });
      } else if (actionType === 'block') {
        await driversApi.block(driver.userId, blockReason.trim() || undefined);
        setDriver(prev => prev ? { ...prev, status: 'blocked', blockReason: blockReason.trim() || null } : null);
        toast({ title: m.toast.blocked, variant: 'success' });
      } else if (actionType === 'unblock') {
        await driversApi.unblock(driver.userId);
        setDriver(prev => prev ? { ...prev, status: 'active', blockReason: null } : null);
        toast({ title: m.toast.unblocked, variant: 'success' });
      } else if (actionType === 'addFunds') {
        // Butun so'm, ≠ 0, |summa| ≤ 5 mln — backend bilan bir xil (§25 #6).
        const invalid = validateBalanceAdjustment(fundsAmount);
        if (invalid) {
          toast({ title: mc.error, description: invalid, variant: 'error' });
          return;
        }
        const amount = Number(fundsAmount);
        const res = await driversApi.addFunds(driver.id, amount, fundsNote.trim());
        setDriver(prev => prev ? { ...prev, ...(res.data.data as Partial<Driver>) } : null);
        toast({ title: m.toast.balanceUpdated, variant: 'success' });
      } else if (actionType === 'commissionRate') {
        const trimmed = commissionInput.trim();
        const rate = trimmed === '' ? null : parseFloat(trimmed);
        const res = await driversApi.setCommissionRate(driver.id, rate);
        setDriver(prev => prev ? { ...prev, ...(res.data.data as Partial<Driver>) } : null);
        toast({ title: m.toast.commissionUpdated, variant: 'success' });
      }
    } catch (err) {
      const description =
        actionType === 'addFunds'
          ? balanceAdjustmentErrorMessage(err, m.toast.balanceFailed)
          : apiErrorMessage(err, mc.actionFailed);
      toast({ title: apiErrorTitle(err, mc.error), description, variant: 'error' });
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

  const crumbsBase = { label: m.backCrumb, href: '/dashboard/drivers' };

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
        <PageHeader title={m.driver} breadcrumbs={[crumbsBase, { label: m.notFound }]} />
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
              {m.actions.addFunds}
            </Button>
            {driver.status !== 'blocked' ? (
              <Button
                variant="danger-ghost"
                onClick={() => setActionType('block')}
                leftIcon={<ShieldOff className="h-4 w-4" aria-hidden="true" />}
              >
                {m.actions.block}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setActionType('unblock')}
                leftIcon={<Shield className="h-4 w-4" aria-hidden="true" />}
              >
                {m.actions.unblock}
              </Button>
            )}
            {driver.status === 'pending' && (
              <Button
                variant="primary"
                onClick={() => setActionType('approve')}
                leftIcon={<CheckCircle className="h-4 w-4" aria-hidden="true" />}
              >
                {mc.confirm}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 items-start">
        <div className="space-y-4">
          <DetailCard title={m.profile.title}>
            <KeyValueList>
                <KeyValue label={m.profile.phone}>
                  <span className="num">{formatPhone(driver.phone)}</span>
                </KeyValue>
                <KeyValue label={m.profile.car}>
                  {driver.carModel || '—'}
                  {driver.carColor ? ` · ${driver.carColor}` : ''}
                </KeyValue>
                <KeyValue label={m.profile.plate}>
                  <PlateNumber plate={driver.carNumber} />
                </KeyValue>
                {driver.licenseNumber && (
                  <KeyValue label={m.profile.licence}>
                    <span className="font-mono text-xs">{driver.licenseNumber}</span>
                  </KeyValue>
                )}
                <KeyValue label={m.profile.rating}>
                  <span className="num">{formatRating(driver.rating)}</span>
                </KeyValue>
                <KeyValue label={m.profile.trips}>
                  <span className="num">{formatNumber(driver.totalTrips)}</span>
                </KeyValue>
                <KeyValue label={m.profile.registered}>
                  <span className="num">{formatDateShort(driverRegisteredAt(driver))}</span>
                </KeyValue>
                {driver.status === 'blocked' && (
                  <KeyValue label={m.profile.blockReason}>
                    <span className="text-danger-dark dark:text-danger-light">{driver.blockReason || '—'}</span>
                  </KeyValue>
                )}
            </KeyValueList>
          </DetailCard>

          <DetailCard title={m.finance.title}>
            <KeyValueList>
                {/* Manba — DAFTAR (`walletBalance`), `balance` ustuni EMAS. */}
                <KeyValue label={debt ? m.finance.debt : m.finance.wallet}>
                  {driver.walletBalance !== undefined ? (
                    <MoneyText value={driver.walletBalance} signed className="font-semibold" />
                  ) : (
                    '—'
                  )}
                </KeyValue>
                <KeyValue label={m.finance.commission}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="num">
                      {driver.commissionRate != null
                        ? `${driver.commissionRate}%`
                        : defaultCommissionRate != null
                          ? m.finance.defaultRate(defaultCommissionRate)
                          : m.finance.default}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={m.finance.editCommissionAria}
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

          <DriverLegalCard driverId={driver.id} />
        </div>

        <DataTable
          title={m.trips.title}
          className="lg:col-span-2"
          ariaLabel={m.trips.title}
          columns={buildTripColumns()}
          rows={trips}
          rowKey={(t) => t.id}
          loading={tripsLoading}
          error={tripsError}
          onRetry={fetchTrips}
          empty={{ title: m.trips.emptyTitle, description: m.trips.emptyDescription }}
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
        title={actionType ? m.actionTitles[actionType] : undefined}
        description={actionType ? m.actionDescriptions[actionType] : undefined}
        tone={actionType === 'block' ? 'danger' : 'default'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={actionLoading}>
              {mc.cancel}
            </Button>
            <Button
              variant={actionType === 'block' ? 'danger' : 'primary'}
              isLoading={actionLoading}
              onClick={handleAction}
              // Izoh majburiy (backend 400 qaytaradi) — amallar jurnaliga va
              // haydovchiga push matniga tushadi.
              disabled={actionType === 'addFunds' && !fundsNote.trim()}
            >
              {mc.confirm}
            </Button>
          </>
        }
      >
        {actionType === 'block' && (
          <Input
            label={m.modal.blockReason}
            placeholder={m.modal.blockReasonPlaceholder}
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
        )}
        {actionType === 'addFunds' && (
          <div className="space-y-3">
            <Input
              label={m.modal.amount}
              type="number"
              inputMode="numeric"
              step={1}
              placeholder={m.modal.amountPlaceholder}
              value={fundsAmount}
              onChange={(e) => setFundsAmount(e.target.value)}
            />
            <Input
              label={m.modal.note}
              placeholder={m.modal.notePlaceholder}
              value={fundsNote}
              onChange={(e) => setFundsNote(e.target.value)}
              required
              maxLength={200}
            />
          </div>
        )}
        {actionType === 'commissionRate' && (
          <Input
            label={m.modal.commissionLabel(defaultCommissionRate ?? '—')}
            type="number"
            placeholder={m.modal.commissionPlaceholder}
            value={commissionInput}
            onChange={(e) => setCommissionInput(e.target.value)}
          />
        )}
      </Modal>
    </div>
  );
}
