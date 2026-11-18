'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { getIncidents } from '@/lib/incidents-api';
import { INCIDENT_CATEGORIES, type IncidentItem, type IncidentPage, type IncidentStatus, type IncidentVertical } from '@/lib/incidents';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBody } from '@/components/ui/PageBody';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { IncidentFlags, IncidentStatusBadge, categoryLabel, roleLabel } from '@/components/incidents/IncidentBadges';
import { shortId } from '@/lib/format';
import { t } from '@/locales';

type Filter = 'active' | IncidentStatus;
const PAGE_SIZE = 30;

function partyText(item: IncidentItem): string {
  const m = t().incidents;
  const reporter = item.reporter?.name ?? (item.reporterRole === 'system' ? m.system : roleLabel(item.reporterRole));
  const subject = item.subject?.name ?? roleLabel(item.subjectRole);
  return `${reporter} → ${subject}`;
}

/**
 * Shikoyatlar navbati (INCIDENT-POLICY §3): ochiq holatda eng eskisi
 * birinchi, SLA soati nishonda. Sabab va xizmat bo'yicha filtr.
 */
export default function IncidentsPage() {
  const m = t();
  const mi = m.incidents;
  const [filter, setFilter] = useState<Filter>('active');
  const [category, setCategory] = useState('');
  const [vertical, setVertical] = useState<'' | IncidentVertical>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IncidentPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(
        await getIncidents({
          status: filter,
          category: category || undefined,
          vertical: vertical || undefined,
          page,
          limit: PAGE_SIZE,
        }),
      );
      setError(null);
    } catch {
      setError(t().incidents.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [filter, category, vertical, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs = [
    { value: 'active' as const, label: mi.tabs.active },
    { value: 'open' as const, label: mi.tabs.open },
    { value: 'investigating' as const, label: mi.tabs.investigating },
    { value: 'resolved' as const, label: mi.tabs.resolved },
    { value: 'rejected' as const, label: mi.tabs.rejected },
  ];

  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title={mi.title}
        description={mi.description}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} isLoading={isLoading && data !== null} leftIcon={<RefreshCw size={13} aria-hidden />}>
            {m.common.refresh}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <SegmentedControl
          items={tabs}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          ariaLabel={mi.filterAria}
        />
        <div className="w-48">
          <Select
            aria-label={mi.allCategories}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: mi.allCategories }, ...INCIDENT_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))]}
          />
        </div>
        <div className="w-40">
          <Select
            aria-label={mi.allVerticals}
            value={vertical}
            onChange={(e) => {
              setVertical(e.target.value as '' | IncidentVertical);
              setPage(1);
            }}
            options={[
              { value: '', label: mi.allVerticals },
              { value: 'taxi', label: mi.verticals.taxi },
              { value: 'food', label: mi.verticals.food },
              { value: 'market', label: mi.verticals.market },
            ]}
          />
        </div>
      </div>

      {error && data && <RetryBanner message={error} onRetry={() => void load()} keepsLastData className="mb-3" />}

      {error && !data ? (
        <Card padding="none">
          <ErrorState title={error} onRetry={() => void load()} retrying={isLoading} />
        </Card>
      ) : !data ? (
        <SkeletonCards count={4} height="h-[56px]" />
      ) : data.items.length === 0 ? (
        <Card padding="none">
          <EmptyState variant="cleared" icon={<CheckCircle2 aria-hidden />} title={mi.emptyTitle} description={mi.emptyDescription} />
        </Card>
      ) : (
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{mi.columns.category}</TableHead>
                <TableHead>{mi.columns.parties}</TableHead>
                <TableHead>{mi.columns.order}</TableHead>
                <TableHead>{mi.columns.status}</TableHead>
                <TableHead>{mi.columns.age}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={`/dispatch/incidents/${item.id}`} className="font-medium text-primary-text hover:underline">
                      {categoryLabel(item.category)}
                    </Link>
                    <div className="max-w-[320px] truncate text-xs text-muted">{item.description}</div>
                  </TableCell>
                  <TableCell className="text-sm">{partyText(item)}</TableCell>
                  <TableCell className="text-sm">
                    {item.orderVertical ? `${mi.verticals[item.orderVertical]} · ` : ''}
                    <span className="num">{item.orderId ? shortId(item.orderId) : '—'}</span>
                  </TableCell>
                  <TableCell>
                    <IncidentStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <IncidentFlags item={item} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            className="border-t border-line px-3 py-2"
            page={data.page}
            total={data.total}
            pageSize={data.limit}
            totalPages={Math.max(1, Math.ceil(data.total / data.limit))}
            onPageChange={setPage}
          />
        </Card>
      )}
    </PageBody>
  );
}
