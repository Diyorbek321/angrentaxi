'use client';

import { useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useOnlineDrivers } from '@/hooks/useOnlineDrivers';
import { useSocket } from '@/hooks/useSocket';
import { ActiveOrdersList } from '@/components/dispatch/ActiveOrdersList';
import { OnlineDriversList } from '@/components/dispatch/OnlineDriversList';
import { Button } from '@/components/ui/Button';
import { Order } from '@/lib/api';

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card px-4 py-3 flex items-center gap-3">
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
      <div>
        <p className="text-xl font-bold text-[#F1F5F9]">{value}</p>
        <p className="text-xs text-[#94A3B8]">{label}</p>
      </div>
    </div>
  );
}

export default function DispatchPage() {
  const {
    orders,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useActiveOrders();

  const {
    drivers,
    isLoading: driversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useOnlineDrivers();

  const { status: socketStatus } = useSocket();

  // Derived stats
  const searchingCount = orders.filter((o) => o.status === 'searching').length;
  const acceptedCount = orders.filter(
    (o) => o.status === 'accepted' || o.status === 'arrived'
  ).length;
  const inProgressCount = orders.filter((o) => o.status === 'in_progress').length;
  const onlineDriversCount = drivers.length;
  const availableDriversCount = drivers.filter((d) => !d.currentOrderId).length;

  const handleOrderUpdated = useCallback((_order: Order) => {
    // No-op: WS updates handle this reactively via useActiveOrders
  }, []);

  const handleOrderCancelled = useCallback((_orderId: string) => {
    // No-op: WS updates handle this reactively
  }, []);

  const handleRefreshAll = async () => {
    await Promise.all([refetchOrders(), refetchDrivers()]);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Stats bar */}
      <div className="border-b border-white/[0.06] bg-[#080D1A] px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-[#F1F5F9]">Live Dispatch</h1>
            {(ordersLoading || driversLoading) && (
              <Loader2 size={14} className="text-[#94A3B8] animate-spin" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAll}
            leftIcon={<RefreshCw size={13} />}
          >
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatCard
            label="Searching"
            value={searchingCount}
            color="bg-blue-400"
          />
          <StatCard
            label="Accepted"
            value={acceptedCount}
            color="bg-[#10B981]"
          />
          <StatCard
            label="In Progress"
            value={inProgressCount}
            color="bg-orange-400"
          />
          <StatCard
            label="Online Drivers"
            value={onlineDriversCount}
            color="bg-[#FACC15]"
          />
          <StatCard
            label="Available"
            value={availableDriversCount}
            color="bg-emerald-400"
          />
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Active orders (40%) */}
        <div className="w-[40%] border-r border-white/[0.06] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0D1526]/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#F1F5F9]">Active Orders</h2>
              <span className="bg-white/10 text-[#94A3B8] text-xs px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            </div>
            <div
              className={`flex items-center gap-1.5 text-xs ${
                socketStatus === 'connected' ? 'text-[#10B981]' : 'text-[#94A3B8]/40'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  socketStatus === 'connected'
                    ? 'bg-[#10B981] animate-pulse'
                    : 'bg-[#94A3B8]/40'
                }`}
              />
              Live
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ActiveOrdersList
              orders={orders}
              isLoading={ordersLoading}
              error={ordersError}
              onRefetch={refetchOrders}
              onOrderUpdated={handleOrderUpdated}
              onOrderCancelled={handleOrderCancelled}
              drivers={drivers}
            />
          </div>
        </div>

        {/* Right: Online drivers (60%) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0D1526]/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#F1F5F9]">Online Drivers</h2>
              <span className="bg-white/10 text-[#94A3B8] text-xs px-2 py-0.5 rounded-full">
                {drivers.length}
              </span>
            </div>
            <div
              className={`flex items-center gap-1.5 text-xs ${
                socketStatus === 'connected' ? 'text-[#10B981]' : 'text-[#94A3B8]/40'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  socketStatus === 'connected'
                    ? 'bg-[#10B981] animate-pulse'
                    : 'bg-[#94A3B8]/40'
                }`}
              />
              Live
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <OnlineDriversList
              drivers={drivers}
              isLoading={driversLoading}
              error={driversError}
              onRefetch={refetchDrivers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
