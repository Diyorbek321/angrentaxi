import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { driverStatusLabels, type DriverStatus } from '@/lib/constants';

interface DriverStatusBadgeProps {
  status: string;
  isOnline?: boolean;
  className?: string;
}

const VARIANT: Record<DriverStatus, BadgeVariant> = {
  online: 'success',
  offline: 'neutral',
  blocked: 'danger',
  pending: 'info',
};

/** blocked/pending win over the live online flag; otherwise online vs offline. */
export function effectiveDriverStatus(status: string, isOnline?: boolean): DriverStatus {
  if (status === 'blocked') return 'blocked';
  if (status === 'pending') return 'pending';
  return isOnline ? 'online' : 'offline';
}

export function DriverStatusBadge({ status, isOnline, className }: DriverStatusBadgeProps) {
  const s = effectiveDriverStatus(status, isOnline);
  return (
    <Badge variant={VARIANT[s]} dot className={className}>
      {driverStatusLabels()[s] ?? status}
    </Badge>
  );
}
