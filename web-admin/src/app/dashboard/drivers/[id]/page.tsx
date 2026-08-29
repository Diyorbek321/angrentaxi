'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, Car, Phone, Shield, ShieldOff, CheckCircle, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonCards, SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { DriverStatusBadge } from '@/components/drivers/DriverStatusBadge';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { driversApi, settingsApi, Driver, DriverTrip } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import {
  formatCurrency,
  formatDate,
  formatPhone,
  formatRating,
  getFullName,
} from '@/lib/utils';

export default function DriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const driverId = params.id as string;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'block' | 'unblock' | 'addFunds' | 'commissionRate' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [fundsAmount, setFundsAmount] = useState('');
  const [fundsNote, setFundsNote] = useState('');
  const [commissionInput, setCommissionInput] = useState('');
  const [defaultCommissionRate, setDefaultCommissionRate] = useState<number | null>(null);

  const tripsPagination = usePagination(10);

  useEffect(() => {
    const fetchDriver = async () => {
      try {
        const res = await driversApi.getById(driverId);
        setDriver(res.data.data);
      } catch {
        toast({ title: 'Xatolik', description: 'Haydovchi ma\'lumotlarini yuklashda xatolik', variant: 'error' });
        router.push('/dashboard/drivers');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDriver();
  }, [driverId, router, toast]);

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

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Haydovchi ma'lumotlari" icon={<Car className="h-4 w-4" aria-hidden="true" />} />
        <SkeletonCards count={2} height="h-64" />
      </div>
    );
  }

  if (!driver) return null;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={getFullName(driver.firstName, driver.lastName)}
        icon={<Car className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button variant="ghost" size="sm" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
            Orqaga
          </Button>
        }
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Profile card */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-mint-tint text-2xl font-bold text-primary-text"
                  aria-hidden="true"
                >
                  {driver.firstName?.charAt(0)}
                </div>
                <h2 className="mt-4 text-h2 font-semibold text-ink">
                  {getFullName(driver.firstName, driver.lastName)}
                </h2>
                <div className="mt-2">
                  <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
                </div>
                {driver.status === 'blocked' && driver.blockReason && (
                  <p className="mt-2 text-caption text-danger-deep dark:text-danger-light">
                    Sabab: {driver.blockReason}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1">
                  {/* Reyting yulduzi — amber (docs §5: kWarningDark ga eng yaqin). */}
                  <Star className="h-4 w-4 fill-override text-override" aria-hidden="true" />
                  <span className="font-semibold text-ink">{formatRating(driver.rating)}</span>
                  <span className="text-body text-muted">({driver.totalTrips} safar)</span>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-line pt-4">
                <div className="flex items-center gap-3 text-body">
                  <Phone className="h-4 w-4 text-subtle" aria-hidden="true" />
                  <span className="text-ink">{formatPhone(driver.phone)}</span>
                </div>
                <div className="flex items-center gap-3 text-body">
                  <Car className="h-4 w-4 text-subtle" aria-hidden="true" />
                  <span className="text-ink">
                    {driver.carModel}{driver.carColor ? ` · ${driver.carColor}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-body">
                  <span className="rounded-ds-xs border border-line bg-surface-2 px-2 py-1 font-mono text-caption font-semibold text-ink">
                    {driver.carNumber}
                  </span>
                </div>
                {/* Manba — DAFTAR (`walletBalance`), `balance` ustuni EMAS.
                    Ustun yechib olingan pulni hisobga olmaydi, ya'ni operator
                    haydovchi ko'rayotgan raqamdan boshqasini ko'rardi. */}
                {driver.walletBalance !== undefined && (
                  <div className="rounded-ds-md bg-surface-2 p-3 text-center">
                    <p className="text-caption text-subtle">
                      {driver.walletBalance < 0 ? 'Qarz' : 'Hamyon'}
                    </p>
                    <p className={`text-h3 font-bold ${driver.walletBalance < 0 ? 'text-danger-deep dark:text-danger-light' : 'text-ink'}`}>
                      {formatCurrency(driver.walletBalance)}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-ds-md bg-surface-2 px-3 py-2 text-body">
                  <span className="text-muted">Komissiya</span>
                  <button
                    type="button"
                    className="rounded-ds-xs font-semibold text-ink underline decoration-dotted underline-offset-2 hover:text-primary-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
                    onClick={() => {
                      setCommissionInput(driver.commissionRate != null ? String(driver.commissionRate) : '');
                      setActionType('commissionRate');
                    }}
                  >
                    {driver.commissionRate != null
                      ? `${driver.commissionRate}%`
                      : defaultCommissionRate != null
                      ? `Standart (${defaultCommissionRate}%)`
                      : 'Standart'}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {driver.status === 'pending' && (
                  <Button
                    className="w-full"
                    variant="success"
                    onClick={() => setActionType('approve')}
                    leftIcon={<CheckCircle className="h-4 w-4" aria-hidden="true" />}
                  >
                    Tasdiqlash
                  </Button>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setActionType('addFunds')}
                  leftIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                >
                  Hisobni to&apos;ldirish
                </Button>
                {driver.status !== 'blocked' ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => setActionType('block')}
                    leftIcon={<ShieldOff className="h-4 w-4" aria-hidden="true" />}
                  >
                    Bloklash
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="success"
                    onClick={() => setActionType('unblock')}
                    leftIcon={<Shield className="h-4 w-4" aria-hidden="true" />}
                  >
                    Blokdan chiqarish
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats + trips */}
          <div className="space-y-6 lg:col-span-2">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Jami safarlar', value: driver.totalTrips.toString() },
                { label: 'Reyting', value: formatRating(driver.rating) },
                { label: 'Hamyon', value: formatCurrency(driver.walletBalance ?? 0) },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-4 text-center">
                    <p className="text-caption text-muted">{stat.label}</p>
                    <p className="mt-1 text-h2 font-bold text-ink">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Trips table */}
            <Card>
              <CardHeader>
                <CardTitle>Safarlar tarixi</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tripsLoading ? (
                  <SkeletonTable rows={5} cols={4} className="border-0" />
                ) : tripsError ? (
                  <ErrorState message={tripsError} onRetry={fetchTrips} compact />
                ) : trips.length === 0 ? (
                  <EmptyState title="Safarlar yo'q" compact />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Yo&apos;nalish</TableHead>
                          <TableHead>Narx</TableHead>
                          <TableHead>Holat</TableHead>
                          <TableHead>Sana</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trips.map((trip) => (
                          <TableRow key={trip.id}>
                            <TableCell>
                              <p className="max-w-[200px] truncate text-caption text-ink">
                                {trip.pickupAddress ?? '—'}
                              </p>
                              <p className="max-w-[200px] truncate text-caption text-muted">
                                {trip.dropoffAddress ?? '—'}
                              </p>
                            </TableCell>
                            <TableCell className="font-medium text-ink">
                              {formatCurrency(trip.finalPrice ?? trip.estimatedPrice)}
                            </TableCell>
                            <TableCell>
                              <OrderStatusBadge status={trip.status} />
                            </TableCell>
                            <TableCell className="text-caption text-muted">
                              {formatDate(trip.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-center p-4">
                      <Pagination
                        page={tripsPagination.page}
                        totalPages={tripsPagination.totalPages}
                        pageRange={tripsPagination.pageRange}
                        canGoPrev={tripsPagination.canGoPrev}
                        canGoNext={tripsPagination.canGoNext}
                        onPageChange={tripsPagination.goToPage}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirm action modal */}
      <Dialog
        open={!!actionType}
        onOpenChange={() => {
          setActionType(null);
          setBlockReason('');
          setFundsAmount('');
          setFundsNote('');
          setCommissionInput('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Haydovchini tasdiqlash'}
              {actionType === 'block' && 'Haydovchini bloklash'}
              {actionType === 'unblock' && 'Blokdan chiqarish'}
              {actionType === 'addFunds' && "Hisobni to'ldirish"}
              {actionType === 'commissionRate' && 'Komissiya foizini belgilash'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' &&
                'Bu haydovchi tizimda ishlash huquqini oladi. Tasdiqlaysizmi?'}
              {actionType === 'block' &&
                'Bu haydovchi tizimdan bloklanadi. Ishlashni to\'xtatadi.'}
              {actionType === 'unblock' && 'Bu haydovchi yana tizimda ishlash imkoniyatiga ega bo\'ladi.'}
              {actionType === 'addFunds' &&
                "Musbat miqdor balansni to'ldiradi, manfiy miqdor ushlab qoladi (masalan, tuzatish uchun)."}
              {actionType === 'commissionRate' &&
                "Ushbu haydovchi uchun alohida komissiya foizi (masalan, reklama tashigani uchun kamroq). Bo'sh qoldirsangiz, standart foiz qo'llanadi."}
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionType(null)}>
              Bekor qilish
            </Button>
            <Button
              variant={actionType === 'block' ? 'destructive' : 'success'}
              isLoading={actionLoading}
              onClick={handleAction}
            >
              Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
