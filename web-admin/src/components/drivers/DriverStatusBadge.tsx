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
  const color = DRIVER_STATUS_COLORS[effectiveStatus] ?? 'bg-gray-100 text-gray-700';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        color,
        className
      )}
    >
      {effectiveStatus === 'online' && (
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      )}
      {label}
    </span>
  );
}
