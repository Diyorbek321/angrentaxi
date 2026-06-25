import { User, Star, Car, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Driver } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface DriverCardProps {
  driver: Driver;
}

function DriverStatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    online: 'bg-green-400',
    busy: 'bg-yellow-400',
    offline: 'bg-gray-500',
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
        colorMap[status] ?? 'bg-gray-500'
      } ${status === 'online' ? 'ring-2 ring-green-400/30' : ''}`}
    />
  );
}

export function DriverCard({ driver }: DriverCardProps) {
  const isBusy = driver.status === 'busy' || !!driver.currentOrderId;

  return (
    <Card padding="sm" className="hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-9 w-9 rounded-full bg-gray-700 flex items-center justify-center">
            <User size={16} className="text-gray-400" />
          </div>
          <DriverStatusDot
            status={driver.status}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-gray-100 text-sm font-medium truncate">{driver.name}</p>
            <div className="flex items-center gap-1 text-yellow-400 shrink-0">
              <Star size={12} fill="currentColor" />
              <span className="text-xs text-gray-300">{driver.rating.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1 text-gray-500">
              <Car size={12} />
              <span className="text-xs">{driver.carModel}</span>
            </div>
            <span className="text-xs text-gray-400 font-mono">{driver.carNumber}</span>
          </div>

          <div className="flex items-center justify-between mt-2">
            {isBusy ? (
              <Badge variant="warning" size="sm">On trip</Badge>
            ) : (
              <Badge variant="success" size="sm">Available</Badge>
            )}
            <div className="flex items-center gap-1 text-gray-600">
              <Clock size={11} />
              <span className="text-xs text-gray-600">
                {formatDistanceToNow(new Date(driver.lastSeen), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
