'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { getDispatchOverrides, DispatchOverride } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatNumber, shortId } from '@/lib/format';

const PAGE_SIZES = [20, 50, 100] as const;

type DatePreset = 'all' | 'today' | '7d' | '30d';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'today', label: 'Bugun' },
  { value: '7d', label: '7 kun' },
  { value: '30d', label: '30 kun' },
];

function presetCutoff(preset: DatePreset): number | null {
  if (preset === 'all') return null;
  const from = new Date();
  if (preset === 'today') from.setHours(0, 0, 0, 0);
  else from.setDate(from.getDate() - (preset === '7d' ? 7 : 30));
  return from.getTime();
}

/** Ids are all the backend records — no joined names — so they are shown in
 *  the read-aloud short form the dispatchers already use elsewhere. */
function shortRef(id: string | null): string {
  return id ? `…${id.slice(-6).toUpperCase()}` : '—';
}

/**
 * One override = one first-class audit record: who, when, which order, which
 * driver, and — most prominently — WHY. The amber left edge is the panel's
 * one visual claim that a human stepped in (control-room.md); it appears
 * nowhere else on this page.
 */
function OverrideRecord({ override }: { override: DispatchOverride }) {
  return (
    <li className="relative rounded-ds-sm border border-line border-l-2 border-l-override bg-surface px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge variant="override" size="sm">
          <UserCog size={11} aria-hidden />
          Qoʻlda aralashuv
        </Badge>
        <Link
          href={`/orders/${override.orderId}`}
          className="font-mono text-xs text-primary-text hover:underline"
        >
          {shortId(override.orderId)}
        </Link>
        <span className="text-xs text-subtle font-mono tabular-nums ml-auto whitespace-nowrap">
          {formatDateTime(override.createdAt)}
        </span>
      </div>

      {/* The reason is the record — it is why the audit log exists. */}
      <p className="text-sm text-ink leading-relaxed break-words">{override.reason}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="text-subtle">Operator:</span>
          <span className="font-mono">{shortRef(override.performedByUserId)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-subtle">Haydovchi:</span>
          <span className="font-mono">{shortRef(override.previousDriverId)}</span>
          <ArrowRight size={11} className="text-override" aria-hidden />
          <span className="font-mono text-ink">{shortRef(override.newDriverId)}</span>
        </span>
      </div>
    </li>
  );
}

export default function AuditLogPage() {
  const { toast } = useToast();

  const [overrides, setOverrides] = useState<DispatchOverride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchOverrides = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDispatchOverrides(page, pageSize);
      setOverrides(result.overrides);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      console.error('Failed to load dispatch overrides:', err);
      setError('Amallar tarixini yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // The endpoint takes page/limit only, so search and the date presets are
  // applied to the loaded page — the labels below say so rather than implying
  // the whole history was searched.
  const filtered = useMemo(() => {
    const cutoff = presetCutoff(datePreset);
    const needle = search.trim().toLowerCase();
    return overrides
      .filter((o) => (cutoff == null ? true : new Date(o.createdAt).getTime() >= cutoff))
      .filter((o) =>
        needle === ''
          ? true
          : o.reason.toLowerCase().includes(needle) ||
            o.orderId.toLowerCase().includes(needle) ||
            o.newDriverId.toLowerCase().includes(needle) ||
            (o.previousDriverId ?? '').toLowerCase().includes(needle)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [overrides, search, datePreset]);

  const hasFilters = Boolean(search || datePreset !== 'all');

  const clearFilters = () => {
    setSearchInput('');
    setDatePreset('all');
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    downloadCsv(
      'amallar-tarixi',
      ['Vaqt', 'Buyurtma', 'Operator', 'Oldingi haydovchi', 'Yangi haydovchi', 'Sabab'],
      filtered.map((o) => [
        new Date(o.createdAt).toLocaleString('uz-UZ'),
        shortId(o.orderId),
        o.performedByUserId,
        o.previousDriverId ?? '',
        o.newDriverId,
        o.reason,
      ])
    );
    toast({
      title: `${filtered.length} ta yozuv CSV faylga eksport qilindi`,
      description: 'Joriy sahifadagi yozuvlar — filtrlar hisobga olingan.',
      variant: 'success',
    });
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (searchInput) {
      chips.push({
        key: 'q',
        label: `Qidiruv: "${searchInput}"`,
        onRemove: () => setSearchInput(''),
      });
    }
    if (datePreset !== 'all') {
      chips.push({
        key: 'date',
        label: `Sana: ${DATE_PRESETS.find((p) => p.value === datePreset)?.label}`,
        onRemove: () => setDatePreset('all'),
      });
    }
    return chips;
  }, [searchInput, datePreset]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Amallar tarixi"
          description="Har bir qoʻlda aralashuv — kim qilgani, qaysi buyurtma va nima sababdan"
          icon={<ScrollText size={17} />}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={filtered.length === 0}
                leftIcon={<Download size={13} />}
                title="Joriy sahifadagi yozuvlarni CSV sifatida yuklab olish"
              >
                CSV eksport
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchOverrides}
                leftIcon={<RefreshCw size={13} />}
              >
                Yangilash
              </Button>
            </>
          }
        />

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Input
            placeholder="Sabab, buyurtma yoki haydovchi boʻyicha"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftElement={<Search size={14} />}
            className="w-72"
            aria-label="Amallar tarixidan qidirish"
          />
          <div
            role="group"
            aria-label="Sana oraligʻi"
            className="inline-flex items-center rounded-ds-sm border border-line bg-surface-2/60 p-0.5"
          >
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-pressed={datePreset === preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={`h-8 px-2.5 rounded-ds-xs text-xs font-medium transition-colors ${
                  datePreset === preset.value
                    ? 'bg-surface text-ink shadow-card border border-line'
                    : 'text-muted hover:text-ink border border-transparent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-subtle">
            Filtrlar joriy sahifadagi yozuvlarga qoʻllanadi
          </span>
        </div>

        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {activeChips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Hammasini tozalash
            </Button>
          </div>
        )}

        {error && (
          <RetryBanner
            message={error}
            onRetry={fetchOverrides}
            keepsLastData={overrides.length > 0}
            className="mb-3"
          />
        )}

        {error && overrides.length === 0 ? (
          <ErrorState
            message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            onRetry={fetchOverrides}
          />
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonCards count={5} height="h-[104px]" />
        ) : filtered.length === 0 ? (
          <Card>
            {hasFilters ? (
              <EmptyState
                icon={<Search size={22} />}
                title="Filtrga mos yozuv topilmadi"
                description="Qidiruv soʻzini yoki sana oraligʻini oʻzgartirib koʻring."
                action={
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Filtrlarni tozalash
                  </Button>
                }
              />
            ) : (
              <EmptyState
                tone="positive"
                icon={<ShieldCheck size={22} />}
                title="Hali aralashuv boʻlmagan"
                description="Barcha buyurtmalarga haydovchi avtomatik tayinlangan. Qoʻlda tayinlash yoki almashtirish boʻlsa, shu yerda sababi bilan koʻrinadi."
              />
            )}
          </Card>
        ) : (
          <>
            <ul className="space-y-2.5">
              {filtered.map((o) => (
                <OverrideRecord key={o.id} override={o} />
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs text-muted">
              <div className="flex items-center gap-3">
                <span>
                  <span className="font-mono tabular-nums">{filtered.length}</span> / bu sahifada{' '}
                  <span className="font-mono tabular-nums">{overrides.length}</span> · jami{' '}
                  <span className="font-mono tabular-nums">{formatNumber(total)}</span> aralashuv
                </span>
                <label className="flex items-center gap-1.5">
                  <span className="text-subtle">Sahifada:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="Sahifadagi yozuvlar soni"
                    className="h-7 rounded-ds-xs border border-line bg-surface px-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-focus/40"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  leftIcon={<ChevronLeft size={13} />}
                >
                  Oldingi
                </Button>
                <span className="px-3 py-1.5 font-mono tabular-nums bg-surface-2 border border-line rounded-ds-xs">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight size={13} />}
                >
                  Keyingi
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
