import { cn } from '@/lib/utils';
import { DRIVER_STATUS_LABELS, DRIVER_STATUS_COLORS, DriverStatus } from '@/lib/constants';

interface DriverStatusBadgeProps {
  status: string;
  isOnline?: boolean;
  className?: string;
}

export function DriverStatusBadge({ status, isOnline, className }: DriverStatusBadgeProps) {
  // Override with live online state if provided
  const effectiveStatus: DriverStatus =
    status === 'blocked'
      ? 'blocked'
      : status === 'pending'
      ? 'pending'
      : isOnline
      ? 'online'
      : 'offline';

  const label = DRIVER_STATUS_LABELS[effectiveStatus] ?? status;
  const color = DRIVER_STATUS_COLORS[effectiveStatus] ?? 'bg-surface-2 text-muted border border-line';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold',
        color,
        className
      )}
    >
      {effectiveStatus === 'online' && (
        // `mint-deep` — yorug' fonda ko'rinadigan yagona mint (3.37:1);
        // `mint` o'zi bu yerda 2.12:1 bo'lib, indikator sifatida yaramaydi.
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-deep" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
