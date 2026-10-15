'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeVariant,
} from '@/components/ui';
import { tariffChangeRequestsApi, type TariffChangeRequest } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';

const actionLabel: Record<TariffChangeRequest['action'], string> = {
  create: 'Yangi',
  update: 'Yangilash',
};

// Kutilayotgan taklif — admin qarorini kutayotgan qo'lda aralashuv → amber.
const statusVariant: Record<TariffChangeRequest['status'], BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const statusLabel: Record<TariffChangeRequest['status'], string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
};

interface TariffRequestsCardProps {
  requests: TariffChangeRequest[];
  loading: boolean;
  error: string | null;
  onRetry: () => void | Promise<void>;
  /** Called after an approve/reject so the page reloads tariffs + requests. */
  onReviewed: () => void | Promise<void>;
}

/** Managers' tariff proposals — approve (applies immediately) or reject. */
export function TariffRequestsCard({ requests, loading, error, onRetry, onReviewed }: TariffRequestsCardProps) {
  const { toast } = useToast();
  const [reviewRequest, setReviewRequest] = useState<TariffChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const pending = requests.filter((r) => r.status === 'pending').length;

  const close = () => {
    setReviewRequest(null);
    setReviewAction(null);
    setReviewNote('');
  };

  const handleReview = async () => {
    if (!reviewRequest || !reviewAction) return;
    setReviewing(true);
    try {
      if (reviewAction === 'approve') {
        await tariffChangeRequestsApi.approve(reviewRequest.id, reviewNote.trim() || undefined);
        toast({ title: 'Taklif tasdiqlandi', variant: 'success' });
      } else {
        await tariffChangeRequestsApi.reject(reviewRequest.id, reviewNote.trim() || undefined);
        toast({ title: 'Taklif rad etildi', variant: 'success' });
      }
      close();
      await onReviewed();
    } catch {
      toast({ title: 'Xatolik', description: "Taklifni ko'rib chiqishda xatolik", variant: 'error' });
    } finally {
      setReviewing(false);
    }
  };

  const open = (req: TariffChangeRequest, action: 'approve' | 'reject') => {
    setReviewRequest(req);
    setReviewAction(action);
  };

  return (
    <section aria-labelledby="tariff-requests-heading">
      <Card padding="none" className="overflow-hidden">
        <CardHeader
          divider
          title={<span id="tariff-requests-heading">Boshqaruvchilar takliflari</span>}
          description="Tasdiqlangan taklif darhol tariflarga qo'llaniladi"
          actions={pending > 0 ? <Badge variant="warning">{pending} ta kutilmoqda</Badge> : undefined}
        />
        {loading && requests.length === 0 ? (
          <SkeletonTable rows={3} cols={4} className="border-0 rounded-none" />
        ) : error && requests.length === 0 ? (
          <ErrorState compact message={error} onRetry={onRetry} />
        ) : requests.length === 0 ? (
          <EmptyState
            compact
            variant="cleared"
            title="Hozircha takliflar yo'q"
            description="Boshqaruvchilar yuborgan takliflar shu yerda ko'rinadi."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarif</TableHead>
                <TableHead>Amal</TableHead>
                <TableHead>Holati</TableHead>
                <TableHead>Yuborilgan</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Qaror</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">
                    {(req.proposedChanges as { name?: string }).name ?? 'Tarif'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{actionLabel[req.action]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[req.status]} dot>
                      {statusLabel[req.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="num whitespace-nowrap text-muted">
                    {formatDateTime(req.createdAt, { withYear: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === 'pending' && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => open(req, 'reject')}>
                          Rad etish
                        </Button>
                        <Button size="sm" onClick={() => open(req, 'approve')}>
                          Tasdiqlash
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        isOpen={!!reviewRequest}
        onClose={close}
        size="sm"
        tone={reviewAction === 'reject' ? 'danger' : 'default'}
        title={reviewAction === 'approve' ? 'Taklifni tasdiqlash' : 'Taklifni rad etish'}
        description={
          reviewAction === 'approve'
            ? "Ushbu taklifni tasdiqlasangiz, o'zgarishlar darhol tariflarga qo'llaniladi."
            : 'Ushbu taklifni rad etmoqchimisiz?'
        }
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Bekor qilish
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'primary' : 'danger'}
              isLoading={reviewing}
              onClick={handleReview}
            >
              {reviewAction === 'approve' ? 'Tasdiqlash' : 'Rad etish'}
            </Button>
          </>
        }
      >
        <Input
          label="Izoh (ixtiyoriy)"
          placeholder="Sababini yozing..."
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
        />
      </Modal>
    </section>
  );
}
