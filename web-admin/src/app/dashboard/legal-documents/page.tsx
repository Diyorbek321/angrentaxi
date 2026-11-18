'use client';

import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { useResource } from '@/hooks/useResource';
import { formatDateTime, formatNumber } from '@/lib/format';
import { getLocale } from '@/lib/i18n/core';
import {
  acceptanceShare,
  documentUrl,
  legalDocumentsApi,
  olderVersionUsers,
  type LegalDocumentSummary,
} from '@/lib/legal-documents';
import { t } from '@/locales';

/**
 * Oferta va maxfiylik siyosati: joriy tahrirlar va rozilik sonlari
 * (docs/LEGAL-COMPLIANCE.md §28). Faqat o'qish — versiya kodda o'zgartiriladi.
 */
export default function LegalDocumentsPage() {
  const m = t();
  const s$ = m.legalDocs;
  const lang = getLocale() === 'ru' ? 'ru' : 'uz';

  const res = useResource(
    () => legalDocumentsApi.acceptances().then((r) => r.data.data.documents),
    s$.loadError,
  );

  const columns: DataTableColumn<LegalDocumentSummary>[] = [
    {
      key: 'document',
      header: s$.col.document,
      cell: (d) => (
        <div className="min-w-0 leading-tight">
          <p className="font-medium text-ink">{s$.names[d.document] ?? d.document}</p>
          <p className="mt-0.5 max-w-md text-xs text-muted">{d.summary[lang] || d.summary.uz}</p>
        </div>
      ),
    },
    {
      key: 'version',
      header: s$.col.version,
      cell: (d) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="num whitespace-nowrap">{d.version}</span>
          {d.document !== 'privacy' && (
            <Badge variant="warning" size="sm">
              {s$.draft}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'accepted',
      header: s$.col.accepted,
      numeric: true,
      cell: (d) => <span className="num">{formatNumber(d.acceptedCurrent)}</span>,
    },
    {
      key: 'required',
      header: s$.col.required,
      numeric: true,
      hideBelow: 'md',
      cell: (d) => <span className="num">{formatNumber(d.requiredUsers)}</span>,
    },
    {
      key: 'share',
      header: s$.col.share,
      numeric: true,
      cell: (d) => {
        const share = acceptanceShare(d);
        return <span className="num">{share === null ? s$.noUsers : `${share}%`}</span>;
      },
    },
    {
      key: 'older',
      header: s$.col.older,
      numeric: true,
      hideBelow: 'lg',
      cell: (d) => <span className="num text-muted">{formatNumber(olderVersionUsers(d))}</span>,
    },
    {
      key: 'lastAccepted',
      header: s$.col.lastAccepted,
      hideBelow: 'xl',
      cell: (d) => {
        const last = d.versions.find((v) => v.version === d.version)?.lastAcceptedAt;
        return <span className="num whitespace-nowrap text-xs text-muted">{last ? formatDateTime(last) : '—'}</span>;
      },
    },
    {
      key: 'open',
      header: s$.col.open,
      cell: (d) => (
        <div className="flex gap-3 whitespace-nowrap text-xs">
          <a href={documentUrl(d.document, 'uz')} target="_blank" rel="noopener noreferrer" className="text-primary-text hover:underline">
            {s$.openUz}
          </a>
          <a href={documentUrl(d.document, 'ru')} target="_blank" rel="noopener noreferrer" className="text-primary-text hover:underline">
            {s$.openRu}
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title={s$.title} description={s$.description} icon={<FileText aria-hidden />} />
      <DataTable
        ariaLabel={s$.title}
        columns={columns}
        rows={res.data ?? []}
        rowKey={(d) => d.document}
        loading={res.loading}
        error={res.error}
        onRetry={res.reload}
        empty={{ variant: 'first-use', icon: <FileText aria-hidden />, title: s$.emptyTitle }}
      />
    </div>
  );
}
