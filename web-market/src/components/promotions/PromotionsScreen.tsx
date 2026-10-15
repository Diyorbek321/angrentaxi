'use client';

import { useCallback, useMemo, useState } from 'react';
import { BadgePercent, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { errorMessage } from '@/lib/utils';
import {
  PHASE_LABEL,
  discountLabel,
  isPaused,
  promotionPhase,
  type Promotion,
  type PromotionPayload,
  type PromotionPhase,
} from '@/lib/promotions';
import { formatDateTime, formatNumber } from '@/lib/format';
import { usePageRefresh } from '@/components/shell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { IconButton } from '@/components/ui/IconButton';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { PromotionModal } from './PromotionModal';
import type { PromotionCatalog, PromotionVocabulary, PromotionsApiLike } from './types';

interface ScreenData {
  promotions: Promotion[];
  catalog: PromotionCatalog;
}

const PHASES: readonly PromotionPhase[] = ['active', 'scheduled', 'ended'];

const EMPTY_COPY: Record<PromotionPhase, { title: string; description: string }> = {
  active: { title: 'Faol aksiya yoʻq', description: 'Hozir mijozlarga hech qanday chegirma koʻrinmayapti.' },
  scheduled: { title: 'Rejalashtirilgan aksiya yoʻq', description: 'Kelajakda boshlanadigan aksiyalar shu yerda turadi.' },
  ended: { title: 'Tugagan aksiya yoʻq', description: 'Muddati oʻtgan yoki oʻchirilgan aksiyalar shu yerda.' },
};

/**
 * "Chegirmalar" sahifasi — restoran va market panellarida bir xil.
 * Ro'yxat holat bo'yicha (faol / rejalashtirilgan / tugagan), yaratish va
 * tahrirlash modalda, o'chirish — ConfirmDialog orqali.
 */
export function PromotionsScreen({
  api,
  loadCatalog,
  vocab,
}: {
  api: PromotionsApiLike;
  loadCatalog: () => Promise<PromotionCatalog>;
  vocab: PromotionVocabulary;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<PromotionPhase>('active');
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null);
  const [removing, setRemoving] = useState<Promotion | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<ScreenData> => {
    const [p, catalog] = await Promise.all([api.list(), loadCatalog()]);
    return { promotions: p.data.data ?? [], catalog };
  }, [api, loadCatalog]);

  const { data, isLoading, error, reload } = useAsyncData<ScreenData>(load);
  const status: 'loading' | 'error' | 'ready' = isLoading ? 'loading' : data ? 'ready' : 'error';
  usePageRefresh(reload);

  const now = Date.now();
  const promotions = useMemo(() => data?.promotions ?? [], [data]);
  const catalog = data?.catalog ?? { categories: [], items: [] };

  const byPhase = useMemo(() => {
    const t = Date.now();
    const map: Record<PromotionPhase, Promotion[]> = { active: [], scheduled: [], ended: [] };
    promotions.forEach((p) => map[promotionPhase(p, t)].push(p));
    return map;
  }, [promotions]);

  const phaseItems = PHASES.map((value) => ({ value, label: PHASE_LABEL[value], count: byPhase[value].length }));

  const scopeText = (p: Promotion): string => {
    if (p.scope === 'all') return vocab.allItems;
    if (p.scope === 'category') {
      const ids = p.categoryIds ?? [];
      const names = ids.map((id) => catalog.categories.find((c) => c.id === id)?.name).filter(Boolean);
      return names.length > 0 && names.length <= 2 ? names.join(', ') : `${formatNumber(ids.length)} ta kategoriya`;
    }
    return `${formatNumber((p.itemIds ?? []).length)} ta ${vocab.item}`;
  };

  const save = async (payload: PromotionPayload) => {
    const current = editing;
    try {
      if (current && current !== 'new') await api.update(current.id, payload);
      else await api.create(payload);
      toast({ title: current && current !== 'new' ? 'Aksiya saqlandi' : `«${payload.title}» yaratildi`, variant: 'success' });
      setEditing(null);
      await reload();
    } catch (err) {
      toast({ title: 'Saqlab boʻlmadi', description: errorMessage(err), variant: 'error' });
      throw err;
    }
  };

  const toggleActive = async (p: Promotion) => {
    setBusyId(p.id);
    try {
      await api.update(p.id, { isActive: !p.isActive });
      toast({ title: p.isActive ? `«${p.title}» oʻchirildi` : `«${p.title}» yoqildi`, variant: 'success' });
      await reload();
    } catch (err) {
      toast({ title: 'Holatni oʻzgartirib boʻlmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemovePending(true);
    try {
      await api.remove(removing.id);
      toast({ title: `«${removing.title}» oʻchirildi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Oʻchirib boʻlmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setRemovePending(false);
      setRemoving(null);
      await reload();
    }
  };

  const columns: DataTableColumn<Promotion>[] = [
    {
      key: 'title',
      header: 'Aksiya',
      className: 'max-w-[280px]',
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{p.title}</p>
          <p className="line-clamp-1 text-xs text-muted">{p.description || scopeText(p)}</p>
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Chegirma',
      cell: (p) => (
        <Badge variant="success" size="md">
          {discountLabel(p.discountType, p.discountValue)}
        </Badge>
      ),
    },
    { key: 'scope', header: 'Qamrov', hideBelow: 'md', cell: (p) => scopeText(p) },
    {
      key: 'min',
      header: 'Min. buyurtma',
      numeric: true,
      hideBelow: 'xl',
      cell: (p) => (p.minOrderAmount ? <MoneyText value={p.minOrderAmount} className="text-muted" /> : '—'),
    },
    {
      key: 'period',
      header: 'Muddat',
      hideBelow: 'lg',
      className: 'num whitespace-nowrap text-muted',
      cell: (p) => (
        <>
          {formatDateTime(p.startsAt)} — {p.endsAt ? formatDateTime(p.endsAt) : 'muddatsiz'}
        </>
      ),
    },
    {
      key: 'active',
      header: 'Faol',
      width: 'w-36',
      cell: (p) => (
        <span className="flex items-center gap-2">
          <Switch
            checked={p.isActive}
            disabled={busyId === p.id}
            onCheckedChange={() => void toggleActive(p)}
            aria-label={`${p.title} — faol`}
          />
          {isPaused(p, now) && (
            <Badge variant="neutral" size="sm">
              Oʻchirilgan
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      width: 'w-24',
      cell: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton aria-label={`${p.title} — tahrirlash`} onClick={() => setEditing(p)}>
            <Pencil aria-hidden />
          </IconButton>
          <IconButton variant="danger-ghost" aria-label={`${p.title} — oʻchirish`} onClick={() => setRemoving(p)}>
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      ),
    },
  ];

  const hasAny = promotions.length > 0;
  const rows = byPhase[phase];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Chegirmalar"
        description={
          status === 'ready'
            ? `${formatNumber(byPhase.active.length)} ta faol · ${formatNumber(byPhase.scheduled.length)} ta rejalashtirilgan`
            : 'Aksiyalar — chegirma sizning hisobingizdan, mijozga darhol koʻrinadi'
        }
        actions={
          <Button leftIcon={<Plus size={15} />} onClick={() => setEditing('new')} disabled={status !== 'ready'}>
            Yangi aksiya
          </Button>
        }
      />

      <DataTable
        ariaLabel="Aksiyalar"
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        loading={status === 'loading'}
        error={error}
        onRetry={reload}
        rowClassName={(p) => (promotionPhase(p, now) === 'ended' ? 'bg-surface-2/40' : undefined)}
        toolbar={
          hasAny ? (
            <SegmentedControl items={phaseItems} value={phase} onChange={setPhase} label="Aksiya holati boʻyicha" />
          ) : undefined
        }
        isFiltered={hasAny}
        emptyFiltered={{ variant: 'cleared', icon: <BadgePercent size={20} />, ...EMPTY_COPY[phase], onClearFilters: undefined }}
        empty={{
          variant: 'first-use',
          icon: <BadgePercent size={20} />,
          title: 'Hali aksiya yoʻq',
          description: `Chegirma ${vocab.item}ingizni mijoz ilovasidagi «Chegirmalar» lentasiga chiqaradi.`,
          action: (
            <Button leftIcon={<Plus size={15} />} onClick={() => setEditing('new')}>
              Birinchi aksiyani yaratish
            </Button>
          ),
        }}
      />

      {editing && (
        <PromotionModal
          promotion={editing === 'new' ? null : editing}
          catalog={catalog}
          vocab={vocab}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      <ConfirmDialog
        isOpen={removing != null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        isPending={removePending}
        title="Aksiyani oʻchirish"
        description={
          removing
            ? `«${removing.title}» butunlay oʻchiriladi va mijozlarga chegirma koʻrinmay qoladi. Vaqtincha toʻxtatish uchun «Faol» tugmasini oʻchirish yetarli.`
            : undefined
        }
        confirmLabel="O'chirish"
      />
    </div>
  );
}
