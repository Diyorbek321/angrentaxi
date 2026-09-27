'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileCheck2, Phone, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs } from '@/components/ui/Tabs';
import { Drawer } from '@/components/ui/Drawer';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/Table';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import {
  driverReviewApi,
  PendingKycDocument,
  PendingVehicleChange,
  PendingVerification,
  VehicleFields,
} from '@/lib/api';
import { kycDocumentLabel, validateReview } from '@/lib/driver-review';
import { formatDate } from '@/lib/utils';

type Tab = 'kyc' | 'periodic' | 'vehicle';

/** One queue row, whichever queue it came from. */
interface ReviewItem {
  tab: Tab;
  id: string;
  driverName: string | null;
  driverPhone: string | null;
  label: string;
  submittedAt: string;
  /** Only for the vehicle tab: the car before and after. */
  vehicle?: { previous: VehicleFields; proposed: VehicleFields };
}

function fromKyc(doc: PendingKycDocument): ReviewItem {
  return {
    tab: 'kyc',
    id: doc.id,
    driverName: doc.driverName,
    driverPhone: doc.driverPhone,
    label: kycDocumentLabel(doc.documentType),
    submittedAt: doc.uploadedAt,
  };
}

function fromVehicleChange(entry: PendingVehicleChange): ReviewItem {
  return {
    tab: 'vehicle',
    id: entry.id,
    driverName: entry.driverName,
    driverPhone: entry.driverPhone,
    label: 'Mashinani almashtirish',
    submittedAt: entry.createdAt,
    vehicle: { previous: entry.previous, proposed: entry.proposed },
  };
}

function fromVerification(entry: PendingVerification): ReviewItem {
  return {
    tab: 'periodic',
    id: entry.id,
    driverName: entry.driverName,
    driverPhone: entry.driverPhone,
    label: entry.label,
    submittedAt: entry.submittedAt,
  };
}

/**
 * Haydovchi hujjatlari navbati.
 *
 * Ilgari bu ekran umuman yo'q edi: haydovchi KYC hujjati va davriy tekshiruv
 * fotosini yuklardi, lekin ularni hech kim paneldan ko'ra olmasdi. Davriy
 * tekshiruv muddati o'tgach haydovchi onlayn chiqa olmaydi — ya'ni tasdiqlash
 * yo'qligi haydovchini ishsiz qoldirardi.
 */
export default function DriverDocumentsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('kyc');
  const [kyc, setKyc] = useState<ReviewItem[]>([]);
  const [periodic, setPeriodic] = useState<ReviewItem[]>([]);
  const [vehicle, setVehicle] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [open, setOpen] = useState<ReviewItem | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docs, checks, cars] = await Promise.all([
        driverReviewApi.pendingDocuments(),
        driverReviewApi.pendingVerifications(),
        driverReviewApi.pendingVehicleChanges(),
      ]);
      setKyc(docs.data.data.map(fromKyc));
      setPeriodic(checks.data.data.map(fromVerification));
      setVehicle(cars.data.data.map(fromVehicleChange));
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError('Hujjatlar navbatini yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = tab === 'kyc' ? kyc : tab === 'periodic' ? periodic : vehicle;

  const onDecided = (item: ReviewItem, approved: boolean) => {
    const remove = (list: ReviewItem[]) => list.filter((r) => r.id !== item.id);
    if (item.tab === 'kyc') setKyc(remove);
    else if (item.tab === 'periodic') setPeriodic(remove);
    else setVehicle(remove);
    setOpen(null);
    toast({
      title: approved ? 'Tasdiqlandi' : 'Rad etildi',
      description: `${item.driverName ?? item.driverPhone ?? 'Haydovchi'} — ${item.label}`,
      variant: approved ? 'success' : 'info',
    });
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Haydovchi hujjatlari"
        description="KYC hujjatlari, davriy tekshiruv va mashina o'zgarishlari — eng eskisi birinchi"
        icon={<FileCheck2 className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="space-y-4">
        <Tabs
          ariaLabel="Hujjat turi"
          items={[
            { value: 'kyc', label: 'KYC hujjatlari', count: kyc.length },
            { value: 'periodic', label: 'Davriy tekshiruv', count: periodic.length },
            { value: 'vehicle', label: "Mashina o'zgarishi", count: vehicle.length },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        {error && hasLoadedOnce && !isLoading && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi yuklangan ro&apos;yxat ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Qayta urinish
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {showFullError ? (
              <ErrorState message={error} onRetry={() => void load()} />
            ) : isLoading && !hasLoadedOnce ? (
              <SkeletonTable rows={6} cols={4} className="border-0" />
            ) : rows.length === 0 ? (
              <EmptyState
                tone="positive"
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Navbat bo'sh ✓"
                description="Ko'rib chiqilishi kerak bo'lgan hujjat qolmadi."
              />
            ) : (
              <Table stickyHeader containerClassName="max-h-[65vh]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Haydovchi</TableHead>
                    <TableHead>Hujjat</TableHead>
                    <TableHead>Yuborilgan</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="block font-medium text-ink">{row.driverName ?? 'Ismsiz'}</span>
                        {row.driverPhone && (
                          <span className="font-mono text-caption text-muted">{row.driverPhone}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-ink">{row.label}</TableCell>
                      <TableCell className="font-mono text-caption tabular-nums text-muted">
                        {formatDate(row.submittedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setOpen(row)}>
                          Ko&apos;rib chiqish
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ReviewDrawer item={open} onClose={() => setOpen(null)} onDecided={onDecided} />
    </div>
  );
}

function ReviewDrawer({
  item,
  onClose,
  onDecided,
}: {
  item: ReviewItem | null;
  onClose: () => void;
  onDecided: (item: ReviewItem, approved: boolean) => void;
}) {
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('');
  const [fileError, setFileError] = useState(false);
  const [reason, setReason] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  // Fayl blob sifatida olinadi: proksi sessiya cookie'si bilan so'raydi,
  // backend esa ko'rib chiquvchining rolini tekshiradi. Ochiq URL yo'q.
  useEffect(() => {
    setReason('');
    setValidUntil('');
    setFormError(null);
    setFileError(false);
    setFileUrl(null);
    if (!item || item.tab === 'vehicle') return;

    let objectUrl: string | null = null;
    let cancelled = false;
    const request =
      item.tab === 'kyc' ? driverReviewApi.documentFile(item.id) : driverReviewApi.verificationFile(item.id);
    request
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setFileType(res.data.type);
        setFileUrl(objectUrl);
      })
      .catch(() => !cancelled && setFileError(true));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item]);

  const isPdf = useMemo(() => fileType === 'application/pdf', [fileType]);

  if (!item) return null;

  const decide = async (approved: boolean) => {
    const result = validateReview({ approved, reason, validUntil });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    setBusy(approved ? 'approve' : 'reject');
    try {
      const d = result.decision;
      if (item.tab === 'kyc') {
        await driverReviewApi.reviewDocument(
          item.id,
          d.approved ? { status: 'approved' } : { status: 'rejected', reason: d.reason },
        );
      } else if (item.tab === 'vehicle') {
        await driverReviewApi.reviewVehicleChange(
          item.id,
          d.approved ? { approved: true } : { approved: false, note: d.reason },
        );
      } else {
        await driverReviewApi.reviewVerification(
          item.id,
          d.approved ? { approved: true, validUntil: d.validUntil } : { approved: false, rejectionReason: d.reason },
        );
      }
      onDecided(item, approved);
    } catch {
      toast({ title: 'Saqlab bo‘lmadi', description: 'Qayta urinib ko‘ring', variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer
      isOpen
      width="lg"
      onClose={onClose}
      title={item.label}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          {item.driverName ?? 'Ismsiz haydovchi'}
          {item.driverPhone && (
            <a href={`tel:${item.driverPhone}`} className="inline-flex items-center gap-1 font-mono hover:underline">
              <Phone className="h-3 w-3" aria-hidden="true" />
              {item.driverPhone}
            </a>
          )}
        </span>
      }
      footer={
        <div className="space-y-3">
          {formError && (
            <p role="alert" className="text-caption text-danger-deep dark:text-danger-light">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              isLoading={busy === 'reject'}
              disabled={busy !== null}
              leftIcon={<X className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void decide(false)}
            >
              Rad etish
            </Button>
            <Button
              className="flex-1"
              isLoading={busy === 'approve'}
              disabled={busy !== null}
              leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void decide(true)}
            >
              Tasdiqlash
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {item.vehicle ? (
          <VehicleDiff previous={item.vehicle.previous} proposed={item.vehicle.proposed} />
        ) : (
          <div className="overflow-hidden rounded-ds-sm border border-line bg-surface-2">
            {fileError ? (
              <p className="p-6 text-center text-body text-danger-deep dark:text-danger-light">
                Faylni ochib bo&apos;lmadi — u o&apos;chirilgan yoki saqlash xizmati javob bermadi.
              </p>
            ) : !fileUrl ? (
              <div className="skeleton h-72 w-full" aria-hidden />
            ) : isPdf ? (
              <div className="flex flex-col items-center gap-3 p-6">
                <Badge variant="info">PDF</Badge>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-body font-semibold text-primary-text hover:underline"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Hujjatni yangi oynada ochish
                </a>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image cannot optimise it
              <img src={fileUrl} alt={item.label} className="max-h-[60vh] w-full object-contain" />
            )}
          </div>
        )}

        {item.tab === 'periodic' && (
          <Input
            type="date"
            label="Amal qilish muddati (hujjatda yozilgan bo'lsa)"
            hint="Bo'sh qoldirilsa, tekshiruv davriyligi bo'yicha hisoblanadi"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        )}

        <Textarea
          label="Rad etish sababi"
          placeholder="Masalan: rasm xira, davlat raqami o'qilmayapti"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
    </Drawer>
  );
}

const VEHICLE_ROWS: Array<{ key: keyof VehicleFields; label: string }> = [
  { key: 'carModel', label: 'Rusumi' },
  { key: 'carNumber', label: 'Davlat raqami' },
  { key: 'licensePlate', label: 'Raqam (lotin)' },
  { key: 'carYear', label: 'Yili' },
  { key: 'vehicleType', label: 'Transport turi' },
];

/**
 * Eski → yangi. O'zgargan qator ajratib ko'rsatiladi: menejer "faqat raqam
 * o'zgardimi yoki butun mashina?" savoliga bir qarashda javob oladi.
 */
function VehicleDiff({ previous, proposed }: { previous: VehicleFields; proposed: VehicleFields }) {
  const show = (v: string | number | null) => (v === null || v === '' ? '—' : String(v));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Maydon</TableHead>
          <TableHead>Hozir</TableHead>
          <TableHead>So&apos;ralgan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {VEHICLE_ROWS.map(({ key, label }) => {
          const changed = previous[key] !== proposed[key];
          return (
            <TableRow key={key}>
              <TableCell className="text-muted">{label}</TableCell>
              <TableCell className="font-mono text-ink">{show(previous[key])}</TableCell>
              <TableCell className={changed ? 'font-mono font-semibold text-primary-text' : 'font-mono text-muted'}>
                {show(proposed[key])}
                {changed && <span className="sr-only"> (o&apos;zgargan)</span>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
