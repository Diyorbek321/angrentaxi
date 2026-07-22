'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle2, MapPin, PhoneCall, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  getActiveSosAlerts,
  getNoDriversFoundExceptions,
  resolveSosAlert,
  Order,
  SosAlert,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const PAGE_LIMIT = 10;

function SosCard({ alert, onResolved }: { alert: SosAlert; onResolved: (id: string) => void }) {
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await resolveSosAlert(alert.id);
      onResolved(alert.id);
    } catch (err) {
      console.error('Resolve SOS failed:', err);
      window.alert('Failed to resolve alert');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Card padding="none" className="overflow-hidden !border-red-500/30">
      <div className="h-0.5 w-full bg-red-500" />
      <div className="p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
          <ShieldAlert size={16} className="text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="danger" size="sm">SOS</Badge>
            <span className="text-xs text-gray-500 capitalize">{alert.reportedByRole} tomonidan</span>
            <span className="text-xs text-gray-600">
              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1.5">
            <MapPin size={12} />
            {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
          </div>
          <p className="text-xs text-gray-600 mt-1 font-mono">Order #{alert.orderId.slice(-6).toUpperCase()}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleResolve}
          isLoading={isResolving}
          leftIcon={<CheckCircle2 size={13} />}
        >
          Resolve
        </Button>
      </div>
    </Card>
  );
}

function NoDriversRow({ order }: { order: Order }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0">
      <div className="h-7 w-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
        <AlertTriangle size={13} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{order.passenger?.name ?? 'Customer'}</p>
        <p className="text-xs text-gray-500 truncate">{order.pickupAddress ?? '—'}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href={`tel:${order.passenger?.phone}`}>
          <Button size="sm" variant="ghost" leftIcon={<PhoneCall size={13} />}>
            Call
          </Button>
        </a>
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {format(new Date(order.createdAt), 'dd MMM, HH:mm')}
        </span>
      </div>
    </div>
  );
}

export default function ExceptionsPage() {
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [sosLoading, setSosLoading] = useState(true);
  const [noDriversOrders, setNoDriversOrders] = useState<Order[]>([]);
  const [noDriversTotal, setNoDriversTotal] = useState(0);
  const [noDriversPage, setNoDriversPage] = useState(1);
  const [noDriversLoading, setNoDriversLoading] = useState(true);

  const fetchSos = useCallback(async () => {
    setSosLoading(true);
    try {
      setSosAlerts(await getActiveSosAlerts());
    } catch (err) {
      console.error('Failed to load SOS alerts:', err);
    } finally {
      setSosLoading(false);
    }
  }, []);

  const fetchNoDrivers = useCallback(async () => {
    setNoDriversLoading(true);
    try {
      const result = await getNoDriversFoundExceptions(noDriversPage, PAGE_LIMIT);
      setNoDriversOrders(result.data);
      setNoDriversTotal(result.total);
    } catch (err) {
      console.error('Failed to load no-drivers-found exceptions:', err);
    } finally {
      setNoDriversLoading(false);
    }
  }, [noDriversPage]);

  useEffect(() => {
    fetchSos();
    const interval = setInterval(fetchSos, 15000);
    return () => clearInterval(interval);
  }, [fetchSos]);

  useEffect(() => {
    fetchNoDrivers();
  }, [fetchNoDrivers]);

  const handleResolved = (id: string) => {
    setSosAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const totalExceptions = sosAlerts.length;

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="px-6 py-4 border-b border-white/[0.06] bg-[#0D1526]/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F1F5F9]">Exceptions</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">
            What the automatic system couldn&apos;t handle on its own
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { fetchSos(); fetchNoDrivers(); }}
          leftIcon={<RefreshCw size={13} />}
        >
          Refresh
        </Button>
      </div>

      <div className="p-6 space-y-8">
        {/* SOS */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">SOS / Safety</h2>
            {totalExceptions > 0 && <Badge variant="danger" size="sm">{totalExceptions}</Badge>}
          </div>
          {sosLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-800 rounded-lg border border-gray-700 animate-pulse" />
              ))}
            </div>
          ) : sosAlerts.length === 0 ? (
            <Card className="py-10 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 size={28} className="text-emerald-400" />
              <p className="text-gray-300 font-medium">No active SOS alerts</p>
              <p className="text-gray-600 text-sm">Everything&apos;s running normally.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {sosAlerts.map((alert) => (
                <SosCard key={alert.id} alert={alert} onResolved={handleResolved} />
              ))}
            </div>
          )}
        </div>

        {/* No drivers found */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">No drivers found (recent)</h2>
            {noDriversTotal > 0 && <Badge variant="warning" size="sm">{noDriversTotal}</Badge>}
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Orders the matching engine gave up on after its search window. Read-only — a
            cancelled order can&apos;t be reassigned; use Create Order to try again for the
            same customer if they call back.
          </p>
          <Card padding="none">
            {noDriversLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            ) : noDriversOrders.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                No recent no-drivers-found cancellations.
              </div>
            ) : (
              <>
                {noDriversOrders.map((order) => (
                  <NoDriversRow key={order.id} order={order} />
                ))}
                <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500">
                  <span>
                    Page {noDriversPage} of {Math.max(1, Math.ceil(noDriversTotal / PAGE_LIMIT))}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={noDriversPage <= 1}
                      onClick={() => setNoDriversPage((p) => p - 1)}
                    >
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={noDriversPage * PAGE_LIMIT >= noDriversTotal}
                      onClick={() => setNoDriversPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
