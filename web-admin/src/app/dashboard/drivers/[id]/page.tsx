'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, Car, Phone, Shield, ShieldOff, CheckCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
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
import { driversApi, Driver, DriverTrip } from '@/lib/api';
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
  const [actionType, setActionType] = useState<'approve' | 'block' | 'unblock' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');

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
    const fetchTrips = async () => {
      if (!driver) return;
      setTripsLoading(true);
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
        toast({ title: 'Xatolik', description: 'Safarlarni yuklashda xatolik', variant: 'error' });
      } finally {
        setTripsLoading(false);
      }
    };
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
      }
    } catch {
      toast({ title: 'Xatolik', description: 'Amalni bajarishda xatolik', variant: 'error' });
    } finally {
      setActionLoading(false);
      setActionType(null);
      setBlockReason('');
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Haydovchi ma'lumotlari" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!driver) return null;

  return (
    <div>
      <Header title={getFullName(driver.firstName, driver.lastName)} />
      <div className="p-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Orqaga
        </Button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Profile card */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-yellow text-2xl font-bold text-brand-black">
                  {driver.firstName?.charAt(0)}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-gray-100">
                  {getFullName(driver.firstName, driver.lastName)}
                </h2>
                <div className="mt-2">
                  <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
                </div>
                {driver.status === 'blocked' && driver.blockReason && (
                  <p className="mt-2 text-xs text-red-400">
                    Sabab: {driver.blockReason}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1">
                  <Star className="h-4 w-4 fill-brand-yellow text-brand-yellow" />
                  <span className="font-semibold text-gray-100">{formatRating(driver.rating)}</span>
                  <span className="text-sm text-gray-400">({driver.totalTrips} safar)</span>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-300">{formatPhone(driver.phone)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Car className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-300">
                    {driver.carModel}{driver.carColor ? ` · ${driver.carColor}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-xs font-semibold text-gray-300">
                    {driver.carNumber}
                  </span>
                </div>
                {driver.balance !== undefined && (
                  <div className="rounded-lg bg-yellow-500/10 p-3 text-center">
                    <p className="text-xs text-gray-400">Balans</p>
                    <p className="text-lg font-bold text-gray-100">
                      {formatCurrency(driver.balance)}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {driver.status === 'pending' && (
                  <Button
                    className="w-full"
                    variant="success"
                    onClick={() => setActionType('approve')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Tasdiqlash
                  </Button>
                )}
                {driver.status !== 'blocked' ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => setActionType('block')}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Bloklash
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="success"
                    onClick={() => setActionType('unblock')}
                  >
                    <Shield className="mr-2 h-4 w-4" />
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
                { label: 'Balans', value: formatCurrency(driver.balance ?? 0) },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-gray-400">{stat.label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-100">{stat.value}</p>
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
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : trips.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">Safarlar yo&apos;q</p>
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
                              <p className="truncate text-xs text-gray-300 max-w-[200px]">
                                {trip.pickupAddress ?? '—'}
                              </p>
                              <p className="truncate text-xs text-gray-400 max-w-[200px]">
                                {trip.dropoffAddress ?? '—'}
                              </p>
                            </TableCell>
                            <TableCell className="font-medium text-gray-100">
                              {formatCurrency(trip.finalPrice ?? trip.estimatedPrice)}
                            </TableCell>
                            <TableCell>
                              <OrderStatusBadge status={trip.status} />
                            </TableCell>
                            <TableCell className="text-xs text-gray-400">
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
      <Dialog open={!!actionType} onOpenChange={() => { setActionType(null); setBlockReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve'
                ? 'Haydovchini tasdiqlash'
                : actionType === 'block'
                ? 'Haydovchini bloklash'
                : 'Blokdan chiqarish'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' &&
                'Bu haydovchi tizimda ishlash huquqini oladi. Tasdiqlaysizmi?'}
              {actionType === 'block' &&
                'Bu haydovchi tizimdan bloklanadi. Ishlashni to\'xtatadi.'}
              {actionType === 'unblock' && 'Bu haydovchi yana tizimda ishlash imkoniyatiga ega bo\'ladi.'}
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
