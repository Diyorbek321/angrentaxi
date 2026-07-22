'use client';

import { useState } from 'react';
import { User, Star, Car, Search } from 'lucide-react';
import { Driver, Order, assignDriver, reassignDriver } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface AssignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  availableDrivers: Driver[];
  onAssigned: (updatedOrder: Order) => void;
}

const MIN_REASON_LENGTH = 5;

export function AssignDriverModal({
  isOpen,
  onClose,
  order,
  availableDrivers,
  onAssigned,
}: AssignDriverModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [reason, setReason] = useState('');
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isReassign = !!order?.driver;
  const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;

  // Filter to drivers not on a trip
  const freeDrivers = availableDrivers.filter((d) => !d.currentOrderId);

  const filteredDrivers = freeDrivers.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.carNumber.toLowerCase().includes(q) ||
      d.carModel.toLowerCase().includes(q) ||
      d.phone.includes(q)
    );
  });

  const handleAssign = async (driver: Driver) => {
    if (!order || !reasonValid) return;
    setAssigningDriverId(driver.id);
    setError(null);
    try {
      const updated = isReassign
        ? await reassignDriver(order.id, driver.id, reason.trim())
        : await assignDriver(order.id, driver.id, reason.trim());
      onAssigned(updated);
      onClose();
      setSearchQuery('');
      setReason('');
    } catch (err) {
      console.error('Assign failed:', err);
      setError('Failed to assign driver. Please try again.');
    } finally {
      setAssigningDriverId(null);
    }
  };

  const handleClose = () => {
    if (assigningDriverId) return;
    setSearchQuery('');
    setReason('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isReassign ? 'Manual Override — Reassign Driver' : 'Manual Override — Assign Driver'}
      size="md"
    >
      {order && (
        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-gray-700/50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Order #{order.id.slice(-6).toUpperCase()}
            </p>
            <div className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-accent-500 mt-1.5 shrink-0" />
              <p className="text-gray-300 text-xs">{order.pickupAddress ?? '—'}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
              <p className="text-gray-300 text-xs">{order.dropoffAddress ?? '—'}</p>
            </div>
          </div>

          {/* Why this is here */}
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
            <p className="text-amber-400 text-xs">
              Orders normally get a driver automatically. Use this only for an
              exception — no drivers found, an SOS, a driver&apos;s car breaking
              down mid-trip, etc. Every override is logged with your reason.
            </p>
          </div>

          {/* Current driver warning */}
          {isReassign && order.driver && (
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
              <p className="text-yellow-400 text-xs">
                Current driver: <strong>{order.driver.name}</strong> ({order.driver.carNumber})
              </p>
              <p className="text-yellow-600 text-xs mt-1">
                Selecting a new driver will reassign this order.
              </p>
            </div>
          )}

          {/* Reason — required, recorded in the dispatch override audit log */}
          <div>
            <Input
              placeholder="Reason for this override (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {reason.length > 0 && !reasonValid && (
              <p className="text-red-400 text-xs mt-1">
                Reason must be at least {MIN_REASON_LENGTH} characters.
              </p>
            )}
          </div>

          {/* Search */}
          <Input
            placeholder="Search by name, car number, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search size={14} />}
          />

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Drivers list */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {freeDrivers.length === 0
                  ? 'No available drivers online'
                  : 'No drivers match your search'}
              </div>
            ) : (
              filteredDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center gap-3 bg-gray-700/40 hover:bg-gray-700/70 border border-gray-700 hover:border-gray-600 rounded-lg p-3 transition-colors"
                >
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-gray-600 flex items-center justify-center shrink-0">
                    <User size={16} className="text-gray-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-100 text-sm font-medium truncate">
                        {driver.name}
                      </p>
                      <Badge variant="success" size="sm">Available</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1 text-gray-500">
                        <Car size={11} />
                        <span className="text-xs">{driver.carModel}</span>
                      </div>
                      <span className="text-xs font-mono text-gray-400">
                        {driver.carNumber}
                      </span>
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Star size={11} fill="currentColor" />
                        <span className="text-xs text-gray-300">
                          {driver.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assign button — disabled until a reason is entered, since
                      every override is logged against it */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleAssign(driver)}
                    isLoading={assigningDriverId === driver.id}
                    disabled={assigningDriverId !== null || !reasonValid}
                    title={!reasonValid ? 'Enter a reason first' : undefined}
                  >
                    {isReassign ? 'Reassign' : 'Assign'}
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Total count */}
          <p className="text-xs text-gray-600 text-center">
            {freeDrivers.length} driver{freeDrivers.length !== 1 ? 's' : ''} available
          </p>
        </div>
      )}
    </Modal>
  );
}
