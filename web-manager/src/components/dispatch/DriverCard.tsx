import { Car, Clock, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { Driver } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PlateNumber } from '@/components/ui/PlateNumber';
import { formatPhone, formatRating, formatRelative, nameFallback } from '@/lib/format';
import { t } from '@/locales';

interface DriverCardProps {
  driver: Driver;
}

export function DriverCard({ driver }: DriverCardProps) {
  // Same rule as the map pins: mint means free, grey means on a trip.
  const isBusy = driver.status === 'busy' || !!driver.currentOrderId;
  const labels = t().lib.driverStatus;

  return (
    <Card padding="sm" hoverable>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar name={driver.name} size="md" tone={isBusy ? 'muted' : 'mint'} />
          <span
            className={clsx(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface',
              isBusy ? 'bg-line-strong' : 'bg-mint-deep'
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-ink truncate">{driver.name || nameFallback()}</p>
            <span className="flex items-center gap-1 shrink-0 text-xs text-muted">
              <Star size={12} className="text-primary" fill="currentColor" />
              {formatRating(driver.rating)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 mt-1 text-[11px] text-muted min-w-0">
            <span className="flex items-center gap-1 truncate">
              <Car size={11} className="shrink-0" />
              {driver.carModel}
            </span>
            <PlateNumber plate={driver.carNumber} className="shrink-0" />
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            {isBusy ? (
              <Badge variant="neutral" size="sm" dot>
                {labels.busy}
              </Badge>
            ) : (
              <Badge variant="success" size="sm" dot>
                {labels.online}
              </Badge>
            )}
            <span className="flex items-center gap-1 text-[11px] text-subtle shrink-0">
              <Clock size={10} />
              {formatRelative(driver.lastSeen)}
            </span>
          </div>

          <p className="num text-[11px] text-subtle mt-1">{formatPhone(driver.phone)}</p>
        </div>
      </div>
    </Card>
  );
}
