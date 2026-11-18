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
import { t } from '@/locales';

export default function TariffsPage() {
  const m = t();
  const tm = m.tariffs.page;
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
      setLoadError(t().tariffs.page.loadError);
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
      setRequestsError(t().tariffs.page.requestsLoadError);
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
      toast({ title: res.data.data.isActive ? tm.enabled : tm.disabled, variant: 'success' });
    } catch {
      toast({ title: m.common.error, description: m.common.statusChangeFailed, variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tariffsApi.delete(deleteTarget.id);
      toast({ title: tm.deleted, variant: 'success' });
      setDeleteTarget(null);
      await fetchTariffs();
    } catch (err) {
      // The server explains a refusal (orders use the tariff, or it is the last
      // active one of its service) — show that, not a generic failure.
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        tm.deleteError;
      toast({ title: tm.deleteFailed, description: message, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = tariffs.filter((t) => t.isActive).length;

  const columns: DataTableColumn<Tariff>[] = [
    {
      key: 'name',
      header: tm.colTariff,
      cell: (t) => (
        <div className="min-w-0 max-w-[240px]">
          <p className={t.isActive ? 'truncate font-medium text-ink' : 'truncate font-medium text-muted'}>{t.name}</p>
          {t.description && <p className="truncate text-xs text-muted">{t.description}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: m.common.statusAlt,
      cell: (t) => (
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={t.isActive}
            disabled={togglingId === t.id}
            onCheckedChange={() => handleToggle(t)}
            aria-label={tm.toggleAria(t.name, t.isActive)}
          />
          <Badge variant={t.isActive ? 'success' : 'neutral'}>{t.isActive ? m.common.active : m.common.inactive}</Badge>
        </div>
      ),
    },
    { key: 'basePrice', header: tm.colBase, numeric: true, cell: (t) => <MoneyText value={t.basePrice} /> },
    { key: 'minPrice', header: tm.colMin, numeric: true, cell: (t) => <MoneyText value={t.minPrice} /> },
    { key: 'pricePerKm', header: tm.colKm, numeric: true, cell: (t) => <MoneyText value={t.pricePerKm} /> },
    { key: 'pricePerMin', header: tm.colMin1, numeric: true, cell: (t) => <MoneyText value={t.pricePerMin} /> },
    {
      key: 'metered',
      header: tm.colMetered,
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
      header: tm.colMax,
      numeric: true,
      hideBelow: 'xl',
      cell: (t) => (t.maxPrice != null ? <MoneyText value={t.maxPrice} /> : <span className="text-muted">{tm.unlimited}</span>),
    },
    {
      key: 'surge',
      header: tm.colSurge,
      hideBelow: 'xl',
      numeric: true,
      cell: (t) => <SurgeCell tariff={t} onSaved={replaceTariff} />,
    },
    {
      key: 'updatedAt',
      header: tm.colUpdated,
      hideBelow: 'xl',
      className: 'num whitespace-nowrap text-muted',
      cell: (t) => formatDateShort(t.updatedAt),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      width: 'w-20',
      cell: (t) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton size="sm" aria-label={tm.editAria(t.name)} onClick={() => openEdit(t)}>
            <Pencil aria-hidden />
          </IconButton>
          <IconButton
            size="sm"
            variant="danger-ghost"
            aria-label={tm.deleteAria(t.name)}
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
        title={tm.title}
        description={
          tariffs.length > 0
            ? tm.summary(tariffs.length, activeCount)
            : tm.descriptionEmpty
        }
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={openCreate}>
            {tm.newTariff}
          </Button>
        }
      />

      <div className="space-y-5">
        <DataTable
          ariaLabel={tm.tableAria}
          columns={columns}
          rows={tariffs}
          rowKey={(t) => t.id}
          loading={isLoading}
          error={loadError}
          onRetry={fetchTariffs}
          rowClassName={(t) => (t.isActive ? undefined : 'bg-surface-2/40')}
          empty={{
            variant: 'first-use',
            title: tm.empty,
            description: tm.emptyHint,
            action: (
              <Button size="sm" onClick={openCreate}>
                {tm.createFirst}
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
        title={tm.deleteTitle}
        confirmLabel={tm.deleteConfirm}
        description={
          <>
            <strong className="text-ink">{deleteTarget?.name}</strong>
            {tm.deleteQuestion}
          </>
        }
      />
    </div>
  );
}
