'use client';

import { useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { useResource } from '@/hooks/useResource';
import { taxReportApi, type TaxReportEntry } from '@/lib/compliance-api';
import { currentTashkentMonth, isValidMonth } from '@/lib/compliance';
import { taxReportFilename, triggerBlobDownload } from '@/lib/download';
import { taxStatusLabels } from '@/lib/driver-legal';
import { formatNumber, formatPhone, nameFallback } from '@/lib/format';
import { t } from '@/locales';

const Mono = ({ value }: { value: string | null }) =>
  value ? <span className="font-mono text-xs text-ink">{value}</span> : <span className="text-subtle">—</span>;

const getColumns = (): DataTableColumn<TaxReportEntry>[] => {
  const c = t().compliance.taxReport.col;
  return [
  {
    key: 'name',
    header: c.name,
    cell: (r) => (
      <div className="min-w-0 leading-tight">
        <p className="truncate font-medium text-ink">{r.name?.trim() || nameFallback()}</p>
        <p className="num whitespace-nowrap text-xs text-muted">{formatPhone(r.phone)}</p>
      </div>
    ),
  },
  { key: 'pinfl', header: c.pinfl, cell: (r) => <Mono value={r.pinfl} /> },
  { key: 'tin', header: c.tin, hideBelow: 'xl', cell: (r) => <Mono value={r.tin} /> },
  {
    key: 'status',
    header: c.taxStatus,
    hideBelow: 'lg',
    cell: (r) =>
      r.taxStatus ? (
        <Badge variant="neutral">{taxStatusLabels()[r.taxStatus as keyof ReturnType<typeof taxStatusLabels>] ?? r.taxStatus}</Badge>
      ) : (
        <Badge variant="muted-danger">{c.notEntered}</Badge>
      ),
  },
  { key: 'gross', header: c.gross, numeric: true, cell: (r) => <MoneyText value={r.grossIncome} /> },
  {
    key: 'withheld',
    header: c.withheld,
    numeric: true,
    cell: (r) => <MoneyText value={r.withheldAmount} className="font-semibold" />,
  },
  {
    key: 'pending',
    header: c.pending,
    numeric: true,
    hideBelow: 'lg',
    cell: (r) =>
      r.pendingWithheldAmount > 0 ? <MoneyText value={r.pendingWithheldAmount} className="text-muted" /> : <span className="text-subtle">—</span>,
  },
  { key: 'orders', header: c.orders, numeric: true, cell: (r) => <span className="num">{formatNumber(r.orderCount)}</span> },
  ];
};

/** 1% aylanma soligʻi — soliq agenti oylik hisoboti (PQ-247, LEGAL-COMPLIANCE §2). */
export default function TaxReportPage() {
  const m = t();
  const r$ = m.compliance.taxReport;
  const columns = getColumns();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => currentTashkentMonth());
  const [downloading, setDownloading] = useState(false);
  const valid = isValidMonth(month);

  const res = useResource(
    () => (valid ? taxReportApi.get(month).then((r) => r.data.data) : Promise.resolve(null)),
    r$.loadError,
    [month, valid]
  );
  const report = res.data;
  const rows = report?.rows ?? [];

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const r = await taxReportApi.csv(month);
      triggerBlobDownload(r.data, taxReportFilename(month));
      toast({ title: m.finance.csvDownloaded, description: taxReportFilename(month), variant: 'success' });
    } catch {
      toast({ title: m.common.error, description: r$.csvError, variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const statsLoading = res.loading && !res.hasLoaded;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={r$.title}
        description={r$.description}
        actions={
          <Button
            variant="secondary"
            onClick={downloadCsv}
            isLoading={downloading}
            disabled={!valid || rows.length === 0}
            leftIcon={<Download size={14} aria-hidden="true" />}
          >
            {r$.downloadCsv}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={r$.grossIncome} value={<MoneyText value={report?.totals.grossIncome ?? 0} />} isLoading={statsLoading} />
        <StatCard
          label={r$.withheldStat}
          value={<MoneyText value={report?.totals.withheldAmount ?? 0} />}
          hint={r$.withheldHint}
          isLoading={statsLoading}
        />
        <StatCard
          label={r$.col.pending}
          value={<MoneyText value={report?.totals.pendingWithheldAmount ?? 0} />}
          hint={r$.pendingHint}
          isLoading={statsLoading}
        />
        <StatCard
          label={r$.col.orders}
          value={<span className="num">{formatNumber(report?.totals.orderCount ?? 0)}</span>}
          isLoading={statsLoading}
        />
      </div>

      <DataTable
        ariaLabel={r$.tableAria}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.userId}
        loading={res.loading}
        error={res.error}
        onRetry={res.reload}
        toolbar={
          <Input
            type="month"
            aria-label={r$.monthAria}
            value={month}
            max={currentTashkentMonth()}
            error={valid ? undefined : r$.pickMonth}
            onChange={(e) => setMonth(e.target.value)}
            wrapperClassName="w-44"
          />
        }
        empty={{
          variant: 'first-use',
          icon: <Receipt aria-hidden />,
          title: r$.emptyTitle,
          description: valid ? r$.emptyDesc : r$.emptyPickMonth,
        }}
        footer={rows.length > 0 ? <span className="num">{r$.persons(formatNumber(rows.length))}</span> : undefined}
        maxHeightClassName="max-h-[calc(100vh-360px)]"
      />
    </div>
  );
}
