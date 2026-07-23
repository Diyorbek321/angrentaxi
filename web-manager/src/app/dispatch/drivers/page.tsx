'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, CheckCircle, RefreshCw, Star, Wallet, Car } from 'lucide-react';
import {
  getDriverRoster,
  approveDriverProfile,
  addDriverFunds,
  setDriverCommissionRate,
  setDriverTariffTier,
  getCurrentUserProfile,
  DriverProfile,
  TARIFF_TIERS,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

const PAGE_LIMIT = 20;

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
];

const statusVariant: Record<string, BadgeVariant> = {
  pending: 'warning',
  active: 'success',
  blocked: 'danger',
};

export default function DriverRosterPage() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [canManageFinance, setCanManageFinance] = useState(false);

  const [financeTarget, setFinanceTarget] = useState<DriverProfile | null>(null);
  const [fundsAmount, setFundsAmount] = useState('');
  const [fundsNote, setFundsNote] = useState('');
  const [commissionInput, setCommissionInput] = useState('');
  const [financeSaving, setFinanceSaving] = useState<'funds' | 'commission' | null>(null);

  const [tierTarget, setTierTarget] = useState<DriverProfile | null>(null);
  const [tierInput, setTierInput] = useState(1);
  const [tierSaving, setTierSaving] = useState(false);

  useEffect(() => {
    getCurrentUserProfile()
      .then((profile) => setCanManageFinance(profile.permissions.includes('drivers_finance')))
      .catch(() => setCanManageFinance(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDriverRoster({
        page,
        limit: PAGE_LIMIT,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setDrivers(result.drivers);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const handleApprove = async (driver: DriverProfile) => {
    setApprovingId(driver.id);
    try {
      await approveDriverProfile(driver.id);
      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, status: 'active' } : d))
      );
    } catch (err) {
      console.error('Approve failed:', err);
      window.alert('Failed to approve driver');
    } finally {
      setApprovingId(null);
    }
  };

  const openFinance = (driver: DriverProfile) => {
    setFinanceTarget(driver);
    setFundsAmount('');
    setFundsNote('');
    setCommissionInput(driver.commissionRate != null ? String(driver.commissionRate) : '');
  };

  const closeFinance = () => {
    setFinanceTarget(null);
    setFundsAmount('');
    setFundsNote('');
    setCommissionInput('');
  };

  const handleAddFunds = async () => {
    if (!financeTarget) return;
    const amount = parseFloat(fundsAmount);
    if (!amount) {
      window.alert('Enter an amount first');
      return;
    }
    setFinanceSaving('funds');
    try {
      const updated = await addDriverFunds(financeTarget.id, amount, fundsNote.trim() || undefined);
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      setFundsAmount('');
      setFundsNote('');
    } catch (err) {
      console.error('Add funds failed:', err);
      window.alert('Failed to update balance');
    } finally {
      setFinanceSaving(null);
    }
  };

  const handleSetCommission = async () => {
    if (!financeTarget) return;
    const trimmed = commissionInput.trim();
    const rate = trimmed === '' ? null : parseFloat(trimmed);
    setFinanceSaving('commission');
    try {
      const updated = await setDriverCommissionRate(financeTarget.id, rate);
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
    } catch (err) {
      console.error('Set commission rate failed:', err);
      window.alert('Failed to update commission rate');
    } finally {
      setFinanceSaving(null);
    }
  };

  const openTier = (driver: DriverProfile) => {
    setTierTarget(driver);
    setTierInput(driver.approvedTariffTier);
  };

  const handleSetTier = async () => {
    if (!tierTarget) return;
    setTierSaving(true);
    try {
      const updated = await setDriverTariffTier(tierTarget.id, tierInput);
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      setTierTarget(null);
    } catch (err) {
      console.error('Set tariff tier failed:', err);
      window.alert('Failed to update tariff tier');
    } finally {
      setTierSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="px-6 py-4 border-b border-white/[0.06] bg-[#0D1526]/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-[#F1F5F9]">Drivers</h1>
            <p className="text-sm text-[#94A3B8] mt-0.5">
              {total.toLocaleString()} total
              {!canManageFinance && ' · balance/commission need the Drivers Finance permission'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchDrivers} leftIcon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Search by name, phone, plate..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftElement={<Search size={14} />}
            className="w-64"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      <div className="p-6">
        <Card padding="none">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">No drivers found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Tariff tier</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Trips</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Online</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {drivers.map((driver) => (
                      <tr key={driver.id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-gray-100 font-medium">
                            {driver.firstName} {driver.lastName}
                          </p>
                          <p className="text-gray-500 text-xs">{driver.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs">
                          {driver.carModel} · <span className="font-mono">{driver.carNumber}</span>
                          {driver.carYear != null && (
                            <span className="text-gray-500"> · {driver.carYear}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default" size="sm">
                            {TARIFF_TIERS.find((t) => t.tier === driver.approvedTariffTier)?.label ??
                              driver.approvedTariffTier}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-yellow-400">
                            <Star size={12} fill="currentColor" />
                            <span className="text-gray-300 text-xs">{driver.rating.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{driver.totalTrips}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[driver.status] ?? 'default'} size="sm">
                            {driver.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`h-2 w-2 rounded-full inline-block ${driver.isOnline ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {driver.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleApprove(driver)}
                                isLoading={approvingId === driver.id}
                                leftIcon={<CheckCircle size={13} />}
                              >
                                Approve
                              </Button>
                            )}
                            {canManageFinance && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openFinance(driver)}
                                leftIcon={<Wallet size={13} />}
                              >
                                Finance
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openTier(driver)}
                              leftIcon={<Car size={13} />}
                            >
                              Tariff
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 border-t border-gray-700">
                <span>
                  {total} total · page {page} of {Math.max(1, Math.ceil(total / PAGE_LIMIT))}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page * PAGE_LIMIT >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal
        isOpen={!!financeTarget}
        onClose={closeFinance}
        title={financeTarget ? `${financeTarget.firstName} ${financeTarget.lastName} — Finance` : 'Finance'}
        size="md"
      >
        {financeTarget && (
          <div className="space-y-5">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Current balance</p>
              <p className={`text-lg font-bold ${(financeTarget.balance ?? 0) < 0 ? 'text-red-400' : 'text-gray-100'}`}>
                {(financeTarget.balance ?? 0).toLocaleString()} UZS
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300">Top up / correct balance</p>
              <Input
                placeholder="Amount (negative to deduct)"
                type="number"
                value={fundsAmount}
                onChange={(e) => setFundsAmount(e.target.value)}
              />
              <Input
                placeholder="Note (optional)"
                value={fundsNote}
                onChange={(e) => setFundsNote(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddFunds}
                isLoading={financeSaving === 'funds'}
                className="w-full"
              >
                Apply
              </Button>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-700">
              <p className="text-sm font-medium text-gray-300">Commission rate override</p>
              <Input
                placeholder="% — leave blank for platform default"
                type="number"
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSetCommission}
                isLoading={financeSaving === 'commission'}
                className="w-full"
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!tierTarget}
        onClose={() => setTierTarget(null)}
        title={tierTarget ? `${tierTarget.firstName} ${tierTarget.lastName} — Tariff tier` : 'Tariff tier'}
        size="sm"
      >
        {tierTarget && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Highest tariff this driver may be matched against — set after reviewing their car
              {tierTarget.carYear != null ? ` (${tierTarget.carYear})` : ''}.
            </p>
            <Select
              options={TARIFF_TIERS.map((t) => ({ value: String(t.tier), label: t.label }))}
              value={String(tierInput)}
              onChange={(e) => setTierInput(Number(e.target.value))}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSetTier}
              isLoading={tierSaving}
              className="w-full"
            >
              Save
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
