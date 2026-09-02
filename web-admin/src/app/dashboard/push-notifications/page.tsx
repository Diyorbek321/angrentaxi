'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Send, Users, UserCheck, Car } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { broadcastApi, BroadcastAudience, PushBroadcast } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

const TITLE_MAX = 60;
const BODY_MAX = 200;

interface AudienceOption {
  value: BroadcastAudience;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const AUDIENCES: AudienceOption[] = [
  {
    value: 'all',
    label: 'Hamma',
    description: "Yo'lovchilar va haydovchilar — barcha ro'yxatdan o'tganlar",
    icon: <Users className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'customers',
    label: "Faqat yo'lovchilar",
    description: 'Haydovchilar bu xabarni olmaydi',
    icon: <UserCheck className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'drivers',
    label: 'Faqat haydovchilar',
    description: "Yo'lovchilar bu xabarni olmaydi",
    icon: <Car className="h-4 w-4" aria-hidden="true" />,
  },
];

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: 'Hamma',
  customers: "Yo'lovchilar",
  drivers: 'Haydovchilar',
};

export default function PushNotificationsPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; body?: string }>({});
  const [history, setHistory] = useState<PushBroadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await broadcastApi.getHistory();
      setHistory(res.data.data?.broadcasts ?? []);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli tarix ekranda qoladi; banner + retry chiqadi.
      setError("Yuborish tarixini yuklab bo'lmadi");
      toast({ title: 'Xatolik', description: 'Tarixni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validatsiya maydonning O'ZIGA biriktiriladi — toast emas.
  const validate = (): boolean => {
    const errors: { title?: string; body?: string } = {};
    if (!title.trim()) errors.title = 'Sarlavhani kiriting';
    else if (title.trim().length > TITLE_MAX) errors.title = `Ko'pi bilan ${TITLE_MAX} belgi`;
    if (!body.trim()) errors.body = 'Xabar matnini kiriting';
    else if (body.trim().length > BODY_MAX) errors.body = `Ko'pi bilan ${BODY_MAX} belgi`;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openConfirm = () => {
    if (validate()) setConfirmOpen(true);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await broadcastApi.send(title.trim(), body.trim(), audience);
      const sentCount = res.data.data?.sentCount;
      toast({
        title: 'Xabar yuborildi',
        description:
          sentCount != null
            ? `${sentCount.toLocaleString('uz-UZ')} ta qurilmaga yetkazildi.`
            : `Auditoriya: ${AUDIENCE_LABELS[audience]}`,
        variant: 'success',
      });
      setTitle('');
      setBody('');
      setFieldErrors({});
      setConfirmOpen(false);
      await loadHistory();
    } catch {
      toast({ title: 'Xatolik', description: 'Yuborishda xatolik', variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;
  const selectedAudience = AUDIENCES.find((a) => a.value === audience)!;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Push xabarnomalar"
        description="Foydalanuvchilarga ommaviy push-xabar yuborish"
        icon={<BellRing className="h-4 w-4" aria-hidden="true" />}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Yangi xabar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Sarlavha"
              placeholder="Masalan: Hafta oxiri chegirmasi"
              value={title}
              maxLength={TITLE_MAX + 20}
              error={fieldErrors.title}
              hint={`${title.trim().length} / ${TITLE_MAX} belgi`}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              label="Matn"
              placeholder="Xabarning to'liq matni..."
              value={body}
              rows={4}
              error={fieldErrors.body}
              hint={`${body.trim().length} / ${BODY_MAX} belgi`}
              onChange={(e) => setBody(e.target.value)}
            />

            <fieldset>
              <legend className="mb-2 block text-caption font-medium text-muted">Auditoriya</legend>
              {/* Auditoriya tanlovi — kim OLADI va kim OLMAYDI, ikkalasi ham
                  yozilgan. Tanlangan variant IKKI vizual belgi oladi:
                  to'q yashil chegara + tinted yuza (rang yolg'iz emas). */}
              <div className="grid gap-2">
                {AUDIENCES.map((option) => {
                  const active = audience === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-ds-md border p-3 transition-colors duration-fast',
                        'focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-surface',
                        active
                          ? 'border-primary bg-mint-tint'
                          : 'border-line bg-surface hover:bg-surface-2'
                      )}
                    >
                      <input
                        type="radio"
                        name="audience"
                        value={option.value}
                        checked={active}
                        onChange={() => setAudience(option.value)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-sm',
                          active ? 'bg-mint text-mint-on' : 'bg-surface-2 text-muted'
                        )}
                        aria-hidden="true"
                      >
                        {option.icon}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-body font-semibold',
                            active ? 'text-primary-text' : 'text-ink'
                          )}
                        >
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-caption text-muted">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex items-start gap-2 rounded-ds-md border border-override/30 bg-override-tint px-3 py-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-override-dark dark:text-override-light"
                aria-hidden="true"
              />
              <p className="text-caption text-override-dark dark:text-override-light">
                Push-xabar tashqi foydalanuvchilarga bir zumda boradi va uni qaytarib
                bo&apos;lmaydi. Yuborishdan oldin matnni tekshiring.
              </p>
            </div>

            <Button onClick={openConfirm} leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
              Yuborish
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yuborish tarixi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {showErrorBanner && (
              <div
                role="alert"
                className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
              >
                <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {error} — oxirgi yuklangan tarix ko&apos;rsatilmoqda.
                </p>
                <Button variant="secondary" size="sm" onClick={loadHistory}>
                  Qayta urinish
                </Button>
              </div>
            )}

            {showFullError ? (
              <ErrorState message={error} onRetry={loadHistory} />
            ) : isLoading && !hasLoadedOnce ? (
              <div className="px-5 pb-5">
                <SkeletonCards count={4} height="h-16" />
              </div>
            ) : history.length === 0 ? (
              <EmptyState
                icon={<BellRing className="h-6 w-6" />}
                title="Hali xabar yuborilmagan"
                description="Birinchi push-xabarni yuborganingizda, u shu yerda ko'rinadi."
              />
            ) : (
              <div className="max-h-[60vh] divide-y divide-divider overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-body font-semibold text-ink">{h.title}</p>
                      <Badge variant="secondary">
                        {AUDIENCE_LABELS[h.audience] ?? h.audience}
                      </Badge>
                    </div>
                    <p className="mt-1 text-body leading-relaxed text-muted">{h.body}</p>
                    <p className="mt-1.5 text-caption tabular-nums text-subtle">
                      {formatDate(h.createdAt)} · {h.sentCount.toLocaleString('uz-UZ')} ta yetkazildi
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TASHQARIGA qaratilgan ommaviy amal — aniq tasdiqlash: kim oladi va
          xabar aynan qanday ko'rinishi qayta ko'rsatiladi. */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push-xabarni yuborish</DialogTitle>
            <DialogDescription>
              Xabar <strong>{selectedAudience.label.toLowerCase()}</strong> auditoriyasiga darhol
              yuboriladi. {selectedAudience.description}. Yuborilgan xabarni qaytarib yoki
              o&apos;chirib bo&apos;lmaydi.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-ds-md border border-line bg-surface-2 p-4">
            <p className="text-caption text-subtle">Qurilmada shunday ko&apos;rinadi:</p>
            <div className="mt-2 rounded-ds-sm border border-line bg-surface p-3">
              <p className="text-body font-semibold text-ink">{title.trim()}</p>
              <p className="mt-1 text-body leading-relaxed text-muted">{body.trim()}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              isLoading={sending}
              onClick={handleSend}
              leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}
            >
              Yuborish — {selectedAudience.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
