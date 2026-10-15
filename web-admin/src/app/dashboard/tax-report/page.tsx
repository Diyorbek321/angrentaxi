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
import { TAX_STATUS_LABELS } from '@/lib/driver-legal';
import { formatNumber, formatPhone } from '@/lib/format';

const Mono = ({ value }: { value: string | null }) =>
  value ? <span className="font-mono text-xs text-ink">{value}</span> : <span className="text-subtle">—</span>;

const columns: DataTableColumn<TaxReportEntry>[] = [
  {
    key: 'name',
    header: 'Haydovchi / kuryer',
    cell: (r) => (
      <div className="min-w-0 leading-tight">
        <p className="truncate font-medium text-ink">{r.name?.trim() || 'Ism kiritilmagan'}</p>
        <p className="num whitespace-nowrap text-xs text-muted">{formatPhone(r.phone)}</p>
      </div>
    ),
  },
  { key: 'pinfl', header: 'JShShIR', cell: (r) => <Mono value={r.pinfl} /> },
  { key: 'tin', header: 'STIR', hideBelow: 'xl', cell: (r) => <Mono value={r.tin} /> },
  {
    key: 'status',
    header: 'Soliq maqomi',
    hideBelow: 'lg',
    cell: (r) =>
      r.taxStatus ? (
        <Badge variant="neutral">{TAX_STATUS_LABELS[r.taxStatus as keyof typeof TAX_STATUS_LABELS] ?? r.taxStatus}</Badge>
      ) : (
        <Badge variant="muted-danger">Kiritilmagan</Badge>
      ),
  },
  { key: 'gross', header: 'Daromad', numeric: true, cell: (r) => <MoneyText value={r.grossIncome} /> },
  {
    key: 'withheld',
    header: 'Ushlangan',
    numeric: true,
    cell: (r) => <MoneyText value={r.withheldAmount} className="font-semibold" />,
  },
  {
    key: 'pending',
    header: 'Kutilmoqda',
    numeric: true,
    hideBelow: 'lg',
    cell: (r) =>
      r.pendingWithheldAmount > 0 ? <MoneyText value={r.pendingWithheldAmount} className="text-muted" /> : <span className="text-subtle">—</span>,
  },
  { key: 'orders', header: 'Buyurtmalar', numeric: true, cell: (r) => <span className="num">{formatNumber(r.orderCount)}</span> },
];

/** 1% aylanma soligʻi — soliq agenti oylik hisoboti (PQ-247, LEGAL-COMPLIANCE §2). */
export default function TaxReportPage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(() => currentTashkentMonth());
  const [downloading, setDownloading] = useState(false);
  const valid = isValidMonth(month);

  const res = useResource(
    () => (valid ? taxReportApi.get(month).then((r) => r.data.data) : Promise.resolve(null)),
    'Soliq hisobotini yuklab boʻlmadi.',
    [month, valid]
  );
  const report = res.data;
  const rows = report?.rows ?? [];

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const r = await taxReportApi.csv(month);
      triggerBlobDownload(r.data, taxReportFilename(month));
      toast({ title: 'CSV yuklab olindi', description: taxReportFilename(month), variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'CSV faylni yuklab boʻlmadi', variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const statsLoading = res.loading && !res.hasLoaded;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Soliq (1%) hisoboti"
        description="Har bir haydovchi/kuryer boʻyicha daromad va ushlab qolingan aylanma soligʻi (oy — yakunlangan sana, Toshkent)"
        actions={
          <Button
            variant="secondary"
            onClick={downloadCsv}
            isLoading={downloading}
            disabled={!valid || rows.length === 0}
            leftIcon={<Download size={14} aria-hidden="true" />}
          >
            CSV yuklab olish
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Yalpi daromad" value={<MoneyText value={report?.totals.grossIncome ?? 0} />} isLoading={statsLoading} />
        <StatCard
          label="Ushlab qolingan"
          value={<MoneyText value={report?.totals.withheldAmount ?? 0} />}
          hint="Byudjetga oʻtkazish — qoʻlda (CSV asosida)"
          isLoading={statsLoading}
        />
        <StatCard
          label="Kutilmoqda"
          value={<MoneyText value={report?.totals.pendingWithheldAmount ?? 0} />}
          hint="Karta puli hali yigʻilmagan safarlar"
          isLoading={statsLoading}
        />
        <StatCard
          label="Buyurtmalar"
          value={<span className="num">{formatNumber(report?.totals.orderCount ?? 0)}</span>}
          isLoading={statsLoading}
        />
      </div>

      <DataTable
        ariaLabel="Soliq hisoboti"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.userId}
        loading={res.loading}
        error={res.error}
        onRetry={res.reload}
        toolbar={
          <Input
            type="month"
            aria-label="Hisobot oyi"
            value={month}
            max={currentTashkentMonth()}
            error={valid ? undefined : 'Oyni tanlang'}
            onChange={(e) => setMonth(e.target.value)}
            wrapperClassName="w-44"
          />
        }
        empty={{
          variant: 'first-use',
          icon: <Receipt aria-hidden />,
          title: 'Bu oyda maʼlumot yoʻq',
          description: valid
            ? 'Tanlangan oyda yakunlangan safar yoki ushlab qolingan soliq yoʻq. Ushlab qolish «Huquqiy talablar» sahifasida yoqiladi.'
            : 'Hisobot oyini tanlang.',
        }}
        footer={rows.length > 0 ? <span className="num">{formatNumber(rows.length)} ta shaxs</span> : undefined}
        maxHeightClassName="max-h-[calc(100vh-360px)]"
      />
    </div>
  );
}
