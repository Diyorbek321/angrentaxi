'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, RefreshCw, ShieldCheck, UserCog } from 'lucide-react';
import { getDispatchOverrides, DispatchOverride } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageBody } from '@/components/ui/PageBody';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, shortId } from '@/lib/format';

const PAGE_SIZES = [20, 50, 100] as const;

type DatePreset = 'all' | 'today' | '7d' | '30d';

const DATE_PRESETS: readonly { value: DatePreset; label: string }[] = [
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

/**
 * One override = one first-class audit record: who, when, which order, which
 * driver, and — most prominently — WHY. The amber left edge is the panel's
 * one visual claim that a human stepped in (control-room.md); it appears
 * nowhere else on this page.
 */
function OverrideRecord({ override }: { override: DispatchOverride }) {
  return (
    <li className="relative border-l-2 border-l-override px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge variant="override" size="sm">
          <UserCog size={11} aria-hidden />
          Qoʻlda aralashuv
        </Badge>
        <Link
          href={`/orders/${override.orderId}`}
          className="font-mono text-xs text-primary-text hover:underline"
          aria-label={`Buyurtma ${shortId(override.orderId)}`}
        >
          {shortId(override.orderId)}
        </Link>
        <span className="num text-xs text-subtle ml-auto whitespace-nowrap">
          {formatDateTime(override.createdAt)}
        </span>
      </div>

      {/* The reason is the record — it is why the audit log exists. */}
      <p className="text-[13px] text-ink leading-relaxed break-words">{override.reason}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="text-subtle">Operator:</span>
          <span className="font-mono">{shortId(override.performedByUserId)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-subtle">Haydovchi:</span>
          <span className="font-mono">{shortId(override.previousDriverId)}</span>
          <ArrowRight size={11} className="text-override" aria-hidden />
          <span className="font-mono text-ink">{shortId(override.newDriverId)}</span>
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
        formatDateTime(o.createdAt, { withYear: true }),
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
    <PageBody className="max-w-5xl">
      <PageHeader
        title="Amallar tarixi"
        description="Har bir qoʻlda aralashuv — kim qilgani, qaysi buyurtma va nima sababdan"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
              title="Joriy sahifadagi yozuvlarni CSV sifatida yuklab olish"
            >
              CSV eksport
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchOverrides}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
          </>
        }
      />

      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Sabab, buyurtma yoki haydovchi boʻyicha"
        chips={activeChips}
        onClearAll={clearFilters}
        className="mb-3"
        actions={<span className="text-xs text-subtle">Filtrlar joriy sahifadagi yozuvlarga qoʻllanadi</span>}
      >
        <SegmentedControl
          items={DATE_PRESETS}
          value={datePreset}
          onChange={setDatePreset}
          ariaLabel="Sana oraligʻi"
        />
      </FilterBar>

      {error && overrides.length > 0 && (
        <RetryBanner message={error} onRetry={fetchOverrides} keepsLastData className="mb-3" />
      )}

      {error && overrides.length === 0 ? (
        <Card padding="none">
          <ErrorState
            title={error}
            message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            onRetry={fetchOverrides}
            retrying={isLoading}
          />
        </Card>
      ) : isLoading && !hasLoadedOnce ? (
        <SkeletonCards count={5} height="h-[96px]" />
      ) : filtered.length === 0 ? (
        <Card padding="none">
          {hasFilters ? (
            <EmptyState
              variant="no-results"
              title="Filtrga mos yozuv topilmadi"
              description="Qidiruv soʻzini yoki sana oraligʻini oʻzgartirib koʻring."
              onClearFilters={clearFilters}
            />
          ) : (
            <EmptyState
              variant="cleared"
              icon={<ShieldCheck aria-hidden />}
              title="Hali aralashuv boʻlmagan"
              description="Barcha buyurtmalarga haydovchi avtomatik tayinlangan. Qoʻlda tayinlash yoki almashtirish boʻlsa, shu yerda sababi bilan koʻrinadi."
            />
          )}
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-line">
            {filtered.map((o) => (
              <OverrideRecord key={o.id} override={o} />
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZES}
          />
        </Card>
      )}
    </PageBody>
  );
}
