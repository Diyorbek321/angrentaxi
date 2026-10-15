'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  IconButton,
  MoneyText,
  PageHeader,
  Switch,
  type DataTableColumn,
} from '@/components/ui';
import { SurgeCell } from '@/components/tariffs/SurgeCell';
import { TariffFormModal } from '@/components/tariffs/TariffFormModal';
import { TariffRequestsCard } from '@/components/tariffs/TariffRequestsCard';
import { tariffsApi, tariffChangeRequestsApi, type Tariff, type TariffChangeRequest } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatDateShort, formatMoney } from '@/lib/format';
import { meteredPriceLabel } from '@/lib/metered-price';

export default function TariffsPage() {
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tariff | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<TariffChangeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const fetchTariffs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tariffsApi.getAll();
      setTariffs(res.data.data);
      setLoadError(null);
    } catch {
      setLoadError('Tariflarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await tariffChangeRequestsApi.getAll();
      setRequests(res.data.data);
      setRequestsError(null);
    } catch {
      setRequestsError('Takliflarni yuklashda xatolik');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTariffs();
    void fetchRequests();
  }, [fetchTariffs, fetchRequests]);

  const openCreate = () => {
    setEditingTariff(null);
    setFormOpen(true);
  };

  const openEdit = (tariff: Tariff) => {
    setEditingTariff(tariff);
    setFormOpen(true);
  };

  const replaceTariff = (next: Tariff) => setTariffs((prev) => prev.map((t) => (t.id === next.id ? next : t)));

  const handleToggle = async (tariff: Tariff) => {
    setTogglingId(tariff.id);
    try {
      const res = await tariffsApi.toggleActive(tariff.id, !tariff.isActive);
      replaceTariff(res.data.data);
      toast({ title: res.data.data.isActive ? 'Tarif yoqildi' : "Tarif o'chirildi", variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: "Holatni o'zgartirib bo'lmadi", variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tariffsApi.delete(deleteTarget.id);
      toast({ title: "Tarif o'chirildi", variant: 'success' });
      setDeleteTarget(null);
      await fetchTariffs();
    } catch (err) {
      // The server explains a refusal (orders use the tariff, or it is the last
      // active one of its service) — show that, not a generic failure.
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Tarifni o'chirishda xatolik";
      toast({ title: "O'chirib bo'lmadi", description: message, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = tariffs.filter((t) => t.isActive).length;

  const columns: DataTableColumn<Tariff>[] = [
    {
      key: 'name',
      header: 'Tarif',
      cell: (t) => (
        <div className="min-w-0 max-w-[240px]">
          <p className={t.isActive ? 'truncate font-medium text-ink' : 'truncate font-medium text-muted'}>{t.name}</p>
          {t.description && <p className="truncate text-xs text-muted">{t.description}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Holati',
      cell: (t) => (
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={t.isActive}
            disabled={togglingId === t.id}
            onCheckedChange={() => handleToggle(t)}
            aria-label={`${t.name} tarifini ${t.isActive ? 'faolsizlantirish' : 'faollashtirish'}`}
          />
          <Badge variant={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Faol' : 'Nofaol'}</Badge>
        </div>
      ),
    },
    { key: 'basePrice', header: "Boshlang'ich", numeric: true, cell: (t) => <MoneyText value={t.basePrice} /> },
    { key: 'minPrice', header: 'Minimum', numeric: true, cell: (t) => <MoneyText value={t.minPrice} /> },
    { key: 'pricePerKm', header: '1 km', numeric: true, cell: (t) => <MoneyText value={t.pricePerKm} /> },
    { key: 'pricePerMin', header: '1 daqiqa', numeric: true, cell: (t) => <MoneyText value={t.pricePerMin} /> },
    {
      key: 'metered',
      header: 'Taksometr km',
      numeric: true,
      hideBelow: 'xl',
      cell: (t) =>
        t.meteredPricePerKm == null ? (
          <span className="text-muted">{meteredPriceLabel(null, formatMoney)}</span>
        ) : (
          <MoneyText value={t.meteredPricePerKm} />
        ),
    },
    {
      key: 'maxPrice',
      header: 'Maksimum',
      numeric: true,
      hideBelow: 'xl',
      cell: (t) => (t.maxPrice != null ? <MoneyText value={t.maxPrice} /> : <span className="text-muted">Cheklanmagan</span>),
    },
    {
      key: 'surge',
      header: 'Talab koef.',
      hideBelow: 'xl',
      numeric: true,
      cell: (t) => <SurgeCell tariff={t} onSaved={replaceTariff} />,
    },
    {
      key: 'updatedAt',
      header: 'Yangilangan',
      hideBelow: 'xl',
      className: 'num whitespace-nowrap text-muted',
      cell: (t) => formatDateShort(t.updatedAt),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      width: 'w-20',
      cell: (t) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton size="sm" aria-label={`${t.name} tarifini tahrirlash`} onClick={() => openEdit(t)}>
            <Pencil aria-hidden />
          </IconButton>
          <IconButton
            size="sm"
            variant="danger-ghost"
            aria-label={`${t.name} tarifini o'chirish`}
            onClick={() => setDeleteTarget(t)}
          >
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Tariflar"
        description={
          tariffs.length > 0
            ? `${tariffs.length} ta tarif · ${activeCount} tasi faol`
            : 'Narx siyosatini boshqaring'
        }
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={openCreate}>
            Yangi tarif
          </Button>
        }
      />

      <div className="space-y-5">
        <DataTable
          ariaLabel="Tariflar ro'yxati"
          columns={columns}
          rows={tariffs}
          rowKey={(t) => t.id}
          loading={isLoading}
          error={loadError}
          onRetry={fetchTariffs}
          rowClassName={(t) => (t.isActive ? undefined : 'bg-surface-2/40')}
          empty={{
            variant: 'first-use',
            title: "Tariflar yo'q",
            description: 'Narx siyosati birinchi tarifdan boshlanadi.',
            action: (
              <Button size="sm" onClick={openCreate}>
                Birinchi tarifni yarating
              </Button>
            ),
          }}
        />

        <TariffRequestsCard
          requests={requests}
          loading={requestsLoading}
          error={requestsError}
          onRetry={fetchRequests}
          onReviewed={() => Promise.all([fetchTariffs(), fetchRequests()]).then(() => undefined)}
        />
      </div>

      <TariffFormModal
        open={formOpen}
        tariff={editingTariff}
        onClose={() => setFormOpen(false)}
        onSaved={fetchTariffs}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isPending={deleting}
        title="Tarifni o'chirish"
        confirmLabel="O'chirish"
        description={
          <>
            <strong className="text-ink">{deleteTarget?.name}</strong> tarifini o&apos;chirmoqchimisiz? Bu amalni
            bekor qilib bo&apos;lmaydi.
          </>
        }
      />
    </div>
  );
}
