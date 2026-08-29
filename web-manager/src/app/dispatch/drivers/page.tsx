'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
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
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatMoney, formatNumber, formatPhone, formatRating } from '@/lib/format';

const PAGE_LIMIT = 20;

const statusOptions = [
  { value: '', label: 'Barcha statuslar' },
  { value: 'pending', label: 'Tasdiq kutmoqda' },
  { value: 'active', label: 'Faol' },
  { value: 'blocked', label: 'Bloklangan' },
];

const statusVariant: Record<string, BadgeVariant> = {
  pending: 'warning',
  active: 'success',
  blocked: 'danger',
};

const statusLabel: Record<string, string> = {
  pending: 'Tasdiq kutmoqda',
  active: 'Faol',
  blocked: 'Bloklangan',
};

export default function DriverRosterPage() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
    } catch (err) {
      console.error('Failed to load drivers:', err);
      setError('Haydovchilar roʻyxatini yuklab boʻlmadi.');
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
      window.alert('Haydovchini tasdiqlab boʻlmadi');
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
      window.alert('Avval summani kiriting');
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
      window.alert('Balansni yangilab boʻlmadi');
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
      window.alert('Komissiya foizini yangilab boʻlmadi');
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
      window.alert('Tarif darajasini yangilab boʻlmadi');
    } finally {
      setTierSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const hasFilters = Boolean(statusFilter || searchInput);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4">
        <PageHeader
          title="Haydovchilar"
          icon={<Users size={17} />}
          description={
            canManageFinance
              ? `Jami ${formatNumber(total)} ta haydovchi`
              : `Jami ${formatNumber(total)} ta · balans va komissiya uchun «Drivers Finance» ruxsati kerak`
          }
          className="mb-4"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDrivers}
              leftIcon={<RefreshCw size={13} />}
            >
              Yangilash
            </Button>
          }
        />

        <div className="flex items-center gap-3 flex-wrap mb-5">
          <Input
            placeholder="Ism, telefon yoki mashina raqami"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftElement={<Search size={14} />}
            className="w-64"
            aria-label="Haydovchilarni qidirish"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
            aria-label="Status boʻyicha filtr"
          />
        </div>

        {error ? (
          <ErrorState message={error} onRetry={fetchDrivers} />
        ) : isLoading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : drivers.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users size={22} />}
              title={hasFilters ? 'Filtrga mos haydovchi topilmadi' : 'Haydovchilar yoʻq'}
              description={
                hasFilters ? 'Qidiruv yoki status filtrini oʻzgartirib koʻring.' : undefined
              }
              action={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchInput('');
                      setStatusFilter('');
                    }}
                  >
                    Filtrlarni tozalash
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-subtle uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Haydovchi</th>
                    <th className="px-4 py-3 font-semibold">Mashina</th>
                    <th className="px-4 py-3 font-semibold">Tarif darajasi</th>
                    <th className="px-4 py-3 font-semibold">Reyting</th>
                    <th className="px-4 py-3 font-semibold">Safarlar</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Onlayn</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {drivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            name={`${driver.firstName} ${driver.lastName}`}
                            size="sm"
                            tone={driver.isOnline ? 'mint' : 'muted'}
                          />
                          <div className="min-w-0">
                            <p className="text-ink font-medium truncate">
                              {driver.firstName} {driver.lastName}
                            </p>
                            <p className="text-subtle text-[11px] font-mono">
                              {formatPhone(driver.phone)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {driver.carModel} · <span className="font-mono">{driver.carNumber}</span>
                        {driver.carYear != null && (
                          <span className="text-subtle"> · {driver.carYear}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="mint-soft" size="sm">
                          {TARIFF_TIERS.find((t) => t.tier === driver.approvedTariffTier)?.label ??
                            driver.approvedTariffTier}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Star size={12} className="text-primary" fill="currentColor" />
                          {formatRating(driver.rating)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs font-mono">
                        {formatNumber(driver.totalTrips)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[driver.status] ?? 'default'} size="sm">
                          {statusLabel[driver.status] ?? driver.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          title={driver.isOnline ? 'Onlayn' : 'Oflayn'}
                          className={`h-2.5 w-2.5 rounded-full inline-block ${
                            driver.isOnline ? 'bg-mint-deep' : 'bg-line-strong'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          {driver.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleApprove(driver)}
                              isLoading={approvingId === driver.id}
                              leftIcon={<CheckCircle2 size={13} />}
                            >
                              Tasdiqlash
                            </Button>
                          )}
                          {canManageFinance && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openFinance(driver)}
                              leftIcon={<Wallet size={13} />}
                            >
                              Moliya
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openTier(driver)}
                            leftIcon={<Car size={13} />}
                          >
                            Tarif
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted border-t border-line">
              <span>
                Jami <span className="font-mono">{formatNumber(total)}</span> · {page} / {totalPages}{' '}
                sahifa
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  leftIcon={<ChevronLeft size={13} />}
                >
                  Oldingi
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page * PAGE_LIMIT >= total}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight size={13} />}
                >
                  Keyingi
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={!!financeTarget}
        onClose={closeFinance}
        title={
          financeTarget
            ? `${financeTarget.firstName} ${financeTarget.lastName} — moliya`
            : 'Moliya'
        }
        size="md"
      >
        {financeTarget && (
          <div className="space-y-5">
            <div className="rounded-xl border border-line bg-surface-2/60 p-4 text-center">
              {/* Daftardan hisoblangan qoldiq — haydovchi o'z ilovasida
                  AYNAN shu raqamni ko'radi. `balance` ustuni yechib olingan
                  pulni hisobga olmagani uchun bu yerda ishlatilmaydi. */}
              <p className="text-xs text-muted">
                {(financeTarget.walletBalance ?? 0) < 0 ? 'Qarz' : 'Hamyon'}
              </p>
              <p
                className={`font-mono text-xl font-bold mt-1 ${
                  (financeTarget.walletBalance ?? 0) < 0
                    ? 'text-danger'
                    : 'text-primary-700 dark:text-primary-300'
                }`}
              >
                {formatMoney(financeTarget.walletBalance ?? 0)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Balansni toʻldirish / tuzatish</p>
              <Input
                placeholder="Summa (ayirish uchun manfiy son)"
                type="number"
                mono
                value={fundsAmount}
                onChange={(e) => setFundsAmount(e.target.value)}
              />
              <Input
                placeholder="Izoh (ixtiyoriy)"
                value={fundsNote}
                onChange={(e) => setFundsNote(e.target.value)}
              />
              <Button
                size="sm"
                variant="primary"
                onClick={handleAddFunds}
                isLoading={financeSaving === 'funds'}
                className="w-full"
              >
                Qoʻllash
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t border-line">
              <p className="text-sm font-medium text-ink">Komissiya foizi</p>
              <Input
                placeholder="% — boʻsh qoldirilsa platforma qiymati"
                type="number"
                mono
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
                Saqlash
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!tierTarget}
        onClose={() => setTierTarget(null)}
        title={
          tierTarget
            ? `${tierTarget.firstName} ${tierTarget.lastName} — tarif darajasi`
            : 'Tarif darajasi'
        }
        size="sm"
      >
        {tierTarget && (
          <div className="space-y-4">
            <p className="text-xs text-muted leading-relaxed">
              Bu haydovchi qatnasha oladigan eng yuqori tarif — mashinasi
              {tierTarget.carYear != null ? ` (${tierTarget.carYear}-yil)` : ''} koʻrib chiqilgach
              belgilanadi.
            </p>
            <Select
              options={TARIFF_TIERS.map((t) => ({ value: String(t.tier), label: t.label }))}
              value={String(tierInput)}
              onChange={(e) => setTierInput(Number(e.target.value))}
            />
            <Button
              size="sm"
              variant="primary"
              onClick={handleSetTier}
              isLoading={tierSaving}
              className="w-full"
            >
              Saqlash
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
