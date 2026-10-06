'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Megaphone, Plus, Store, Trash2, UtensilsCrossed } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { CreateAdDialog } from '@/components/ads/CreateAdDialog';
import { adsApi, type AdBanner } from '@/lib/api';
import { AD_LINK_LABELS, AD_STATE_LABELS, adCtr, adState, formatCtr, type AdState } from '@/lib/ads';
import { formatDate } from '@/lib/utils';

// Amber intizomi: amber faqat qo'lda aralashuv uchun — bu yerda yo'q.
const STATE_BADGE: Record<AdState, 'success' | 'info' | 'secondary'> = {
  live: 'success',
  scheduled: 'info',
  ended: 'secondary',
  off: 'secondary',
};

const LINK_ICON = { restaurant: UtensilsCrossed, store: Store, url: ExternalLink } as const;

function windowText(ad: AdBanner): string {
  const from = ad.startsAt ? formatDate(ad.startsAt, 'dd.MM.yyyy') : 'Hozirdan';
  const to = ad.endsAt ? formatDate(ad.endsAt, 'dd.MM.yyyy') : 'muddatsiz';
  return `${from} — ${to}`;
}

export default function AdsPage() {
  const { toast } = useToast();
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdBanner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAds = async () => {
    setIsLoading(true);
    try {
      const res = await adsApi.getAll();
      setAds(res.data.data);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError("Bannerlarni yuklab bo'lmadi");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (ad: AdBanner) => {
    setTogglingId(ad.id);
    try {
      const res = await adsApi.update(ad.id, { isActive: !ad.isActive });
      setAds((prev) => prev.map((a) => (a.id === ad.id ? res.data.data : a)));
      toast({
        title: res.data.data.isActive ? 'Banner yoqildi' : "Banner o'chirildi",
        description: ad.title,
        variant: 'success',
      });
    } catch {
      toast({ title: 'Xatolik', description: "Holatni o'zgartirib bo'lmadi", variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adsApi.remove(deleteTarget.id);
      setAds((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast({ title: "Banner o'chirildi", description: deleteTarget.title, variant: 'success' });
      setDeleteTarget(null);
    } catch {
      toast({ title: 'Xatolik', description: "Bannerni o'chirib bo'lmadi", variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const liveCount = ads.filter((a) => adState(a) === 'live').length;
  const showFullError = error && !isLoading && !hasLoadedOnce;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Reklama"
        description={`Bosh ekran karuseli · hozir ${liveCount} ta ko'rsatilmoqda, jami ${ads.length} ta`}
        icon={<Megaphone className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            Banner qo&apos;shish
          </Button>
        }
      />

      <div className="space-y-4">
        {error && hasLoadedOnce && !isLoading && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi yuklangan ma&apos;lumot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchAds}>
              Qayta urinish
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {showFullError ? (
              <ErrorState message={error} onRetry={fetchAds} />
            ) : isLoading && !hasLoadedOnce ? (
              <SkeletonTable rows={4} cols={7} className="border-0" />
            ) : ads.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="h-6 w-6" />}
                title="Bannerlar yo'q"
                description="Reklama beruvchi bilan kelishilgach, bannerni shu yerdan qo'shing — u yo'lovchilarning bosh ekranida ko'rinadi."
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    Banner qo&apos;shish
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banner</TableHead>
                    <TableHead>Muddat</TableHead>
                    <TableHead>Holati</TableHead>
                    <TableHead className="text-right">Ko&apos;rish</TableHead>
                    <TableHead className="text-right">Bosish</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ads.map((ad) => {
                    const state = adState(ad);
                    const LinkIcon = ad.linkType === 'none' ? null : LINK_ICON[ad.linkType];
                    return (
                      <TableRow key={ad.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={adsApi.imageUrl(ad.id)}
                              alt=""
                              loading="lazy"
                              className="h-10 w-20 shrink-0 rounded-ds-sm border border-line bg-surface-2 object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{ad.title}</p>
                              <p className="flex items-center gap-1 text-caption text-muted">
                                {LinkIcon && <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
                                <span className="truncate">
                                  {ad.linkType === 'url' ? ad.linkTarget : AD_LINK_LABELS[ad.linkType]}
                                </span>
                                <span className="text-subtle">· #{ad.sortOrder}</span>
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-caption tabular-nums text-muted">
                          {windowText(ad)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={ad.isActive}
                              disabled={togglingId === ad.id}
                              onCheckedChange={() => handleToggle(ad)}
                              aria-label={`«${ad.title}» bannerini ${ad.isActive ? "o'chirish" : 'yoqish'}`}
                            />
                            <Badge variant={STATE_BADGE[state]} dot>
                              {AD_STATE_LABELS[state]}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-ink">
                          {ad.impressions.toLocaleString('uz-UZ')}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-ink">
                          {ad.clicks.toLocaleString('uz-UZ')}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted">
                          {formatCtr(adCtr(ad))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(ad)}
                            aria-label={`«${ad.title}» bannerini o'chirish`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateAdDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(ad) => setAds((prev) => [...prev, ad].sort((a, b) => a.sortOrder - b.sortOrder))}
      />

      {/* O'chirish qaytarilmaydi va hisoblagichlar (reklama beruvchi hisoboti)
          ham yo'qoladi — shuning uchun tasdiqlash modali. Vaqtincha to'xtatish
          uchun qatordagi kalit bor. */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bannerni o&apos;chirish</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.title}</strong> butunlay o&apos;chiriladi, uning ko&apos;rish va
              bosish statistikasi ham yo&apos;qoladi. Vaqtincha to&apos;xtatish uchun kalitni
              o&apos;chiring.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Bekor qilish
            </Button>
            <Button variant="destructive" isLoading={deleting} onClick={handleDelete}>
              O&apos;chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
