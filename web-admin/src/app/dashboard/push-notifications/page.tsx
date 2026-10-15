'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, Send } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  RadioGroup,
  RetryBanner,
  SkeletonText,
  Textarea,
} from '@/components/ui';
import { broadcastApi, BroadcastAudience, PushBroadcast } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatNumber } from '@/lib/format';

const TITLE_MAX = 60;
const BODY_MAX = 200;

interface AudienceOption {
  value: BroadcastAudience;
  label: string;
  description: string;
}

const AUDIENCES: AudienceOption[] = [
  {
    value: 'all',
    label: 'Hamma',
    description: "Yo'lovchilar va haydovchilar — barcha ro'yxatdan o'tganlar",
  },
  {
    value: 'customers',
    label: "Faqat yo'lovchilar",
    description: 'Haydovchilar bu xabarni olmaydi',
  },
  {
    value: 'drivers',
    label: 'Faqat haydovchilar',
    description: "Yo'lovchilar bu xabarni olmaydi",
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

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await broadcastApi.getHistory();
      setHistory(res.data.data?.broadcasts ?? []);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli tarix ekranda qoladi; banner + retry chiqadi.
      setError("Yuborish tarixini yuklab bo'lmadi");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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
            ? `${formatNumber(sentCount)} ta qurilmaga yetkazildi.`
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
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Push xabarnomalar" description="Foydalanuvchilarga ommaviy push-xabar yuborish" />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Card padding="none">
          <CardHeader title="Yangi xabar" divider />
          <CardBody className="space-y-4 pt-4">
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

            {/* Kim OLADI va kim OLMAYDI — ikkalasi ham yozilgan. */}
            <RadioGroup
              name="audience"
              label="Auditoriya"
              options={AUDIENCES}
              value={audience}
              onChange={setAudience}
            />

            <p className="flex items-start gap-2 text-xs text-muted">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
              Push-xabar foydalanuvchilarga bir zumda boradi va uni qaytarib bo&apos;lmaydi. Yuborishdan oldin
              matnni tekshiring.
            </p>
          </CardBody>
          <CardFooter>
            <Button onClick={openConfirm} leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
              Yuborish
            </Button>
          </CardFooter>
        </Card>

        <Card padding="none">
          <CardHeader title="Yuborish tarixi" divider />
          {showErrorBanner && (
            <RetryBanner message={error} onRetry={loadHistory} keepsLastData className="m-3 mb-0" />
          )}
          {showFullError ? (
            <ErrorState message={error} onRetry={loadHistory} compact />
          ) : isLoading && !hasLoadedOnce ? (
            <div className="divide-y divide-line">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <SkeletonText lines={3} />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              compact
              variant="first-use"
              title="Hali xabar yuborilmagan"
              description="Birinchi push-xabarni yuborganingizda, u shu yerda ko'rinadi."
            />
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{h.title}</p>
                    <Badge variant="neutral">{AUDIENCE_LABELS[h.audience] ?? h.audience}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{h.body}</p>
                  <p className="num mt-1.5 text-xs text-subtle">
                    {formatDateTime(h.createdAt, { withYear: true })} · {formatNumber(h.sentCount)} ta yetkazildi
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* TASHQARIGA qaratilgan ommaviy amal — aniq tasdiqlash: kim oladi va
          xabar aynan qanday ko'rinishi qayta ko'rsatiladi. */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => !sending && setConfirmOpen(false)}
        title="Push-xabarni yuborish"
        description={
          <>
            Xabar <strong className="text-ink">{selectedAudience.label.toLowerCase()}</strong> auditoriyasiga darhol
            yuboriladi. {selectedAudience.description}. Yuborilgan xabarni qaytarib yoki o&apos;chirib bo&apos;lmaydi.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Bekor qilish
            </Button>
            <Button isLoading={sending} onClick={handleSend} leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
              Yuborish — {selectedAudience.label}
            </Button>
          </>
        }
      >
        <div className="rounded-ds-md border border-line bg-surface-2 p-3">
          <p className="text-xs text-subtle">Qurilmada shunday ko&apos;rinadi:</p>
          <div className="mt-2 rounded-ds-sm border border-line bg-surface p-3">
            <p className="text-sm font-semibold text-ink">{title.trim()}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{body.trim()}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
