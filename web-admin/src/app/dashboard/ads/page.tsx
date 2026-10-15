'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ExternalLink, Plus, Store, Trash2, UtensilsCrossed } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  IconButton,
  PageHeader,
  Switch,
  type DataTableColumn,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { CreateAdDialog } from '@/components/ads/CreateAdDialog';
import { adsApi, type AdBanner } from '@/lib/api';
import { AD_LINK_LABELS, AD_STATE_LABELS, adCtr, adState, formatCtr, type AdState } from '@/lib/ads';
import { formatDateShort, formatNumber } from '@/lib/format';

// Hisobot oynasi grafik (recharts) bilan — sahifa birinchi yuklanishiga
// kirmasin; bo'lak sahifa chizilgandan keyin fonda yuklanadi.
const AdDailyDrawer = dynamic(
  () => import('@/components/ads/AdDailyDrawer').then((m) => m.AdDailyDrawer),
  { ssr: false }
);

// Amber intizomi: amber faqat qo'lda aralashuv uchun — bu yerda yo'q.
const STATE_BADGE: Record<AdState, 'success' | 'info' | 'neutral'> = {
  live: 'success',
  scheduled: 'info',
  ended: 'neutral',
  off: 'neutral',
};

const LINK_ICON = { restaurant: UtensilsCrossed, store: Store, url: ExternalLink } as const;

function windowText(ad: AdBanner): string {
  const from = ad.startsAt ? formatDateShort(ad.startsAt) : 'Hozirdan';
  const to = ad.endsAt ? formatDateShort(ad.endsAt) : 'muddatsiz';
  return `${from} — ${to}`;
}

export default function AdsPage() {
  const { toast } = useToast();
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdBanner | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportTarget, setReportTarget] = useState<AdBanner | null>(null);

  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adsApi.getAll();
      setAds(res.data.data);
      setError(null);
    } catch {
      setError("Bannerlarni yuklab bo'lmadi");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAds();
  }, [fetchAds]);

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

  // Ustun tartibi e2e bilan bog'langan: 3 = Ko'rish, 5 = CTR.
  const columns: DataTableColumn<AdBanner>[] = [
    {
      key: 'banner',
      header: 'Banner',
      cell: (ad) => {
        const LinkIcon = ad.linkType === 'none' ? null : LINK_ICON[ad.linkType];
        return (
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={adsApi.imageUrl(ad.id)}
              alt=""
              loading="lazy"
              className="h-8 w-16 shrink-0 rounded-ds-xs border border-line bg-surface-2 object-cover"
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{ad.title}</p>
              <p className="flex items-center gap-1 text-xs text-muted">
                {LinkIcon && <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
                <span className="truncate max-w-[260px]">
                  {ad.linkType === 'url' ? ad.linkTarget : AD_LINK_LABELS[ad.linkType]}
                </span>
                <span className="num text-subtle">· #{ad.sortOrder}</span>
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'window',
      header: 'Muddat',
      className: 'num whitespace-nowrap text-muted',
      cell: (ad) => windowText(ad),
    },
    {
      key: 'state',
      header: 'Holati',
      cell: (ad) => {
        const state = adState(ad);
        return (
          <div className="flex items-center gap-2.5">
            <Switch
              size="sm"
              checked={ad.isActive}
              disabled={togglingId === ad.id}
              onCheckedChange={() => handleToggle(ad)}
              aria-label={`«${ad.title}» bannerini ${ad.isActive ? "o'chirish" : 'yoqish'}`}
            />
            <Badge variant={STATE_BADGE[state]} dot>
              {AD_STATE_LABELS[state]}
            </Badge>
          </div>
        );
      },
    },
    { key: 'impressions', header: "Ko'rish", numeric: true, hideBelow: 'xl', cell: (ad) => formatNumber(ad.impressions) },
    { key: 'clicks', header: 'Bosish', numeric: true, hideBelow: 'xl', cell: (ad) => formatNumber(ad.clicks) },
    {
      key: 'ctr',
      header: 'CTR',
      numeric: true,
      className: 'text-muted',
      cell: (ad) => formatCtr(adCtr(ad)),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      width: 'w-20',
      cell: (ad) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton size="sm" aria-label={`«${ad.title}» kunlik hisoboti`} onClick={() => setReportTarget(ad)}>
            <BarChart3 aria-hidden />
          </IconButton>
          <IconButton
            size="sm"
            variant="danger-ghost"
            aria-label={`«${ad.title}» bannerini o'chirish`}
            onClick={() => setDeleteTarget(ad)}
          >
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Reklama"
        description={
          isLoading && ads.length === 0
            ? 'Bosh ekran karuseli'
            : `Bosh ekran karuseli · hozir ${liveCount} ta ko'rsatilmoqda, jami ${ads.length} ta`
        }
        actions={
          <Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            Banner qo&apos;shish
          </Button>
        }
      />

      <DataTable
        ariaLabel="Reklama bannerlari"
        columns={columns}
        rows={ads}
        rowKey={(ad) => ad.id}
        loading={isLoading}
        error={error}
        onRetry={fetchAds}
        empty={{
          variant: 'first-use',
          title: "Bannerlar yo'q",
          description:
            "Reklama beruvchi bilan kelishilgach, bannerni shu yerdan qo'shing — u yo'lovchilarning bosh ekranida ko'rinadi.",
          action: (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Banner qo&apos;shish
            </Button>
          ),
        }}
      />

      <CreateAdDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(ad) => setAds((prev) => [...prev, ad].sort((a, b) => a.sortOrder - b.sortOrder))}
      />

      <AdDailyDrawer ad={reportTarget} onClose={() => setReportTarget(null)} />

      {/* O'chirish qaytarilmaydi va hisoblagichlar ham yo'qoladi — shuning
          uchun tasdiqlash. Vaqtincha to'xtatish uchun qatordagi kalit bor. */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isPending={deleting}
        title="Bannerni o'chirish"
        confirmLabel="O'chirish"
        description={
          <>
            <strong className="text-ink">{deleteTarget?.title}</strong> butunlay o&apos;chiriladi — rasmi,
            ko&apos;rish va bosish statistikasi (kunlik hisoboti bilan) ham yo&apos;qoladi. Vaqtincha
            to&apos;xtatish uchun kalitni o&apos;chiring.
          </>
        }
      />
    </div>
  );
}
