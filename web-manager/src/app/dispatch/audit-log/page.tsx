'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText } from 'lucide-react';
import { getDispatchOverrides, DispatchOverride } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDateTime, formatNumber, shortId } from '@/lib/format';

const PAGE_LIMIT = 20;

export default function AuditLogPage() {
  const [overrides, setOverrides] = useState<DispatchOverride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverrides = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDispatchOverrides(page, PAGE_LIMIT);
      setOverrides(result.overrides);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      console.error('Failed to load dispatch overrides:', err);
      setError('Amallar tarixini yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4">
        <PageHeader
          title="Amallar tarixi"
          description="Har bir qoʻlda aralashuv — kim qilgani va nima sababdan"
          icon={<ScrollText size={17} />}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchOverrides}
              leftIcon={<RefreshCw size={13} />}
            >
              Yangilash
            </Button>
          }
        />

        {error ? (
          <ErrorState message={error} onRetry={fetchOverrides} />
        ) : isLoading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : overrides.length === 0 ? (
          <Card>
            <EmptyState
              tone="positive"
              icon={<ScrollText size={22} />}
              title="Hali aralashuv boʻlmagan"
              description="Barcha buyurtmalarga haydovchi avtomatik tayinlangan. Qoʻlda tayinlash yoki almashtirish boʻlsa, shu yerda sababi bilan koʻrinadi."
            />
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-subtle uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Vaqt</th>
                    <th className="px-4 py-3 font-semibold">Buyurtma</th>
                    <th className="px-4 py-3 font-semibold">Oldingi haydovchi</th>
                    <th className="px-4 py-3 font-semibold">Yangi haydovchi</th>
                    <th className="px-4 py-3 font-semibold">Sabab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {overrides.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap font-mono">
                        {formatDateTime(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {shortId(o.orderId)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-subtle">
                        {o.previousDriverId ? `…${o.previousDriverId.slice(-6)}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">
                        …{o.newDriverId.slice(-6)}
                      </td>
                      <td className="px-4 py-3 max-w-[340px]">
                        <div className="flex items-start gap-2">
                          <Badge variant="override" size="sm" className="shrink-0">
                            Aralashuv
                          </Badge>
                          <span className="text-xs text-ink break-words">{o.reason}</span>
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
    </div>
  );
}
