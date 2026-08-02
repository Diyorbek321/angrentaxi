'use client';

import { useState } from 'react';
import { AlertTriangle, Car, Search, Star, UserCog } from 'lucide-react';
import { Driver, Order, assignDriver, reassignDriver } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPhone, formatRating, shortId } from '@/lib/format';

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
      setError('Haydovchini tayinlab boʻlmadi. Qaytadan urinib koʻring.');
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
      tone="override"
      size="xl"
      title={isReassign ? 'Qoʻlda aralashuv — haydovchini almashtirish' : 'Qoʻlda aralashuv — haydovchi tayinlash'}
      subtitle={order ? `Buyurtma ${shortId(order.id)}` : undefined}
    >
      {order && (
        <div className="space-y-4">
          {/* Why this exists at all */}
          <div className="flex items-start gap-2.5 rounded-lg border border-override/40 bg-override/[0.08] p-3">
            <AlertTriangle size={15} className="text-override shrink-0 mt-0.5" />
            <p className="text-xs text-override-dark dark:text-override-light leading-relaxed">
              Buyurtmalarga haydovchi odatda <strong>avtomatik</strong> tayinlanadi. Bu oynadan
              faqat istisno holatlarda foydalaning — haydovchi topilmadi, SOS, mashina buzildi va
              hokazo. Har bir aralashuv sababi bilan amallar tarixiga yoziladi.
            </p>
          </div>

          {/* Order summary */}
          <div className="rounded-lg border border-line bg-surface-2/60 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0 ring-2 ring-primary/25" />
              <p className="text-xs text-ink">{order.pickupAddress ?? '—'}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-danger shrink-0" />
              <p className="text-xs text-ink">{order.dropoffAddress ?? '—'}</p>
            </div>
            {isReassign && order.driver && (
              <p className="text-xs text-muted pt-1 border-t border-line">
                Hozirgi haydovchi: <strong className="text-ink">{order.driver.name}</strong>{' '}
                <span className="font-mono">({order.driver.carNumber})</span> — yangi haydovchi
                tanlansa, buyurtma unga oʻtkaziladi.
              </p>
            )}
          </div>

          {/* Reason — required, recorded in the dispatch override audit log */}
          <Textarea
            label="Aralashuv sababi (majburiy)"
            placeholder="Masalan: haydovchi topilmadi, mijoz 20 daqiqa kutdi"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            error={
              reason.length > 0 && !reasonValid
                ? `Sabab kamida ${MIN_REASON_LENGTH} belgidan iborat boʻlishi kerak.`
                : undefined
            }
            hint={
              reasonValid
                ? 'Sabab yozildi — endi haydovchi tanlashingiz mumkin.'
                : 'Sabab kiritilmaguncha tayinlash tugmalari oʻchiq turadi.'
            }
          />

          <Input
            placeholder="Ism, mashina raqami yoki telefon boʻyicha qidirish"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search size={14} />}
          />

          {error && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Only online and free drivers are offered */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredDrivers.length === 0 ? (
              <EmptyState
                compact
                title={
                  freeDrivers.length === 0
                    ? 'Boʻsh haydovchi yoʻq'
                    : 'Qidiruvga mos haydovchi topilmadi'
                }
                description={
                  freeDrivers.length === 0
                    ? 'Hozircha barcha onlayn haydovchilar band.'
                    : undefined
                }
              />
            ) : (
              filteredDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface hover:border-line-strong px-3 py-2.5 transition-colors"
                >
                  <Avatar name={driver.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink truncate">{driver.name}</p>
                      <Badge variant="mint-soft" size="sm">
                        Boʻsh
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-muted">
                      <span className="flex items-center gap-1">
                        <Car size={11} />
                        {driver.carModel}
                      </span>
                      <span className="font-mono">{driver.carNumber}</span>
                      <span className="flex items-center gap-1">
                        <Star size={11} className="text-primary" fill="currentColor" />
                        {formatRating(driver.rating)}
                      </span>
                      <span className="font-mono hidden sm:inline">{formatPhone(driver.phone)}</span>
                    </div>
                  </div>

                  {/* Disabled until a reason is entered — every override is
                      logged against it. */}
                  <Button
                    size="sm"
                    variant="override"
                    onClick={() => handleAssign(driver)}
                    isLoading={assigningDriverId === driver.id}
                    disabled={assigningDriverId !== null || !reasonValid}
                    title={!reasonValid ? 'Avval sababni kiriting' : undefined}
                    leftIcon={<UserCog size={13} />}
                  >
                    {isReassign ? 'Almashtirish' : 'Tayinlash'}
                  </Button>
                </div>
              ))
            )}
          </div>

          <p className="text-[11px] text-subtle text-center">
            {freeDrivers.length} ta boʻsh haydovchi onlayn
          </p>
        </div>
      )}
    </Modal>
  );
}
