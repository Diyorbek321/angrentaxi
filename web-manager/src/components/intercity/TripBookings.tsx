'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { formatMoney, formatPhone } from '@/lib/format';
import { cancelIntercityBooking, getIntercityTripBookings } from '@/lib/intercity-api';
import {
  INTERCITY_BOOKING_STATUS_BADGE,
  intercityBookingStatusLabels,
  bookingKindLabel,
  canDispatcherCancel,
  type IntercityBookingManage,
} from '@/lib/intercity';
import { t } from '@/locales';

interface TripBookingsProps {
  tripId: string;
  /**
   * Qatnov o'zgarganda (socket) ota sahifa shu sonni oshiradi — bandlar
   * ro'yxati ham qayta yuklanadi, aks holda modal eskirgan qatorlarni
   * ko'rsatib turardi.
   */
  refreshKey: number;
  /** Bekor qilishdan keyin qatnov qatorini (joylar soni) yangilash uchun. */
  onChanged: () => void;
}

/** Dispetcher: qatnovdagi yo'lovchilar va bandni bekor qilish. */
export function TripBookings({ tripId, refreshKey, onChanged }: TripBookingsProps) {
  const m = t();
  const mb = m.control.bookings;
  const { toast } = useToast();
  const [bookings, setBookings] = useState<IntercityBookingManage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<IntercityBookingManage | null>(null);
  const [reason, setReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setBookings(await getIntercityTripBookings(tripId));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, t().control.bookings.loadFailed));
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const closeCancel = () => {
    setCancelTarget(null);
    setReason('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget || reason.trim() === '') return;
    setIsCancelling(true);
    try {
      const updated = await cancelIntercityBooking(cancelTarget.orderId, reason.trim());
      setBookings((prev) => prev?.map((b) => (b.orderId === updated.orderId ? updated : b)) ?? null);
      toast({
        title: mb.cancelled,
        description: mb.cancelledDescription(cancelTarget.passenger.name || mb.passenger),
        variant: 'success',
      });
      closeCancel();
      onChanged();
    } catch (err) {
      toast({
        title: apiErrorTitle(err, mb.cancelFailed),
        description: apiErrorMessage(err, mb.tryAgain),
        variant: 'error',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (error && !bookings) {
    return <ErrorState compact message={error} onRetry={load} />;
  }
  if (!bookings) {
    return <SkeletonTable rows={3} cols={5} compact />;
  }
  if (bookings.length === 0) {
    return <EmptyState compact title={mb.emptyTitle} description={mb.emptyDescription} />;
  }

  return (
    <>
      <Table aria-label={mb.tableAria}>
        <TableHeader>
          <TableRow>
            <TableHead>{mb.passenger}</TableHead>
            <TableHead>{mb.booking}</TableHead>
            <TableHead>{mb.status}</TableHead>
            <TableHead>{mb.address}</TableHead>
            <TableHead className="text-right">{mb.price}</TableHead>
            <TableHead>
              <span className="sr-only">{mb.actions}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((b) => (
            <TableRow key={b.orderId} className={b.status === 'cancelled' ? 'text-muted' : undefined}>
              <TableCell>
                <p className="text-ink">{b.passenger.name || mb.passenger}</p>
                {b.passenger.phone && (
                  <a href={`tel:${b.passenger.phone}`} className="num text-xs text-muted hover:underline">
                    {formatPhone(b.passenger.phone)}
                  </a>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">{bookingKindLabel(b)}</TableCell>
              <TableCell>
                <Badge variant={INTERCITY_BOOKING_STATUS_BADGE[b.status]} size="sm" dot>
                  {intercityBookingStatusLabels()[b.status]}
                </Badge>
                {b.cancelReason && <p className="mt-1 text-xs text-muted">{b.cancelReason}</p>}
              </TableCell>
              <TableCell className="text-xs">
                <p>{b.pickupAddress || '—'}</p>
                <p className="text-muted">→ {b.dropoffAddress || '—'}</p>
              </TableCell>
              <TableCell className="num text-right">{formatMoney(b.price)}</TableCell>
              <TableCell className="text-right">
                {canDispatcherCancel(b) && (
                  <Button size="sm" variant="ghost" onClick={() => setCancelTarget(b)}>
                    {m.common.cancel}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        isOpen={cancelTarget !== null}
        onClose={closeCancel}
        onConfirm={confirmCancel}
        title={mb.cancelTitle}
        description={mb.cancelDescription}
        confirmLabel={m.common.cancel}
        tone="danger"
        isPending={isCancelling}
        confirmDisabled={reason.trim() === ''}
      >
        <Textarea
          label={mb.reason}
          required
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mb.reasonPlaceholder}
        />
      </ConfirmDialog>
    </>
  );
}
