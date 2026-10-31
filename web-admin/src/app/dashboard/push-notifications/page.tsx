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
import { t } from '@/locales';

const TITLE_MAX = 60;
const BODY_MAX = 200;

interface AudienceOption {
  value: BroadcastAudience;
  label: string;
  description: string;
}

type FieldErrors = { title?: string; body?: string; titleRu?: string; bodyRu?: string };

const AUDIENCE_ORDER: BroadcastAudience[] = ['all', 'customers', 'drivers'];

function audienceOptions(): AudienceOption[] {
  const a = t().push.audiences;
  return AUDIENCE_ORDER.map((value) => ({ value, ...a[value] }));
}

export default function PushNotificationsPage() {
  const m = t();
  const p = m.push;
  const AUDIENCES = audienceOptions();
  const AUDIENCE_LABELS: Record<BroadcastAudience, string> = p.audienceLabels;
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [titleRu, setTitleRu] = useState('');
  const [bodyRu, setBodyRu] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
      setError(p.historyLoadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Validatsiya maydonning O'ZIGA biriktiriladi — toast emas.
  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = p.titleRequired;
    else if (title.trim().length > TITLE_MAX) errors.title = p.maxChars(TITLE_MAX);
    if (!body.trim()) errors.body = p.bodyRequired;
    else if (body.trim().length > BODY_MAX) errors.body = p.maxChars(BODY_MAX);
    // Ruscha: ikkalasi yoki hech biri — aralash tilli push chiqmasin.
    if (titleRu.trim().length > TITLE_MAX) errors.titleRu = p.maxChars(TITLE_MAX);
    else if (!titleRu.trim() && bodyRu.trim()) errors.titleRu = p.ruIncomplete;
    if (bodyRu.trim().length > BODY_MAX) errors.bodyRu = p.maxChars(BODY_MAX);
    else if (titleRu.trim() && !bodyRu.trim()) errors.bodyRu = p.ruIncomplete;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openConfirm = () => {
    if (validate()) setConfirmOpen(true);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await broadcastApi.send({
        title: title.trim(),
        body: body.trim(),
        ...(hasRu && { titleRu: titleRu.trim(), bodyRu: bodyRu.trim() }),
        audience,
      });
      const sentCount = res.data.data?.sentCount;
      toast({
        title: p.sent,
        description:
          sentCount != null
            ? p.deliveredTo(formatNumber(sentCount))
            : p.audienceIs(AUDIENCE_LABELS[audience]),
        variant: 'success',
      });
      setTitle('');
      setBody('');
      setTitleRu('');
      setBodyRu('');
      setFieldErrors({});
      setConfirmOpen(false);
      await loadHistory();
    } catch {
      toast({ title: m.common.error, description: p.sendFailed, variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;
  const hasRu = Boolean(titleRu.trim() && bodyRu.trim());
  const selectedAudience = AUDIENCES.find((a) => a.value === audience)!;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title={p.title} description={p.description} />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Card padding="none">
          <CardHeader title={p.newMessage} divider />
          <CardBody className="space-y-4 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{p.langUz}</p>
            <Input
              label={p.fieldTitle}
              placeholder={p.fieldTitlePlaceholder}
              value={title}
              maxLength={TITLE_MAX + 20}
              error={fieldErrors.title}
              hint={p.charCount(title.trim().length, TITLE_MAX)}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              label={p.fieldBody}
              placeholder={p.fieldBodyPlaceholder}
              value={body}
              rows={4}
              error={fieldErrors.body}
              hint={p.charCount(body.trim().length, BODY_MAX)}
              onChange={(e) => setBody(e.target.value)}
            />

            <div className="space-y-4 border-t border-line pt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  {p.langRu} <span className="font-normal normal-case tracking-normal">· {p.ruOptional}</span>
                </p>
                <p className="mt-1 text-xs text-muted">{p.ruHint}</p>
              </div>
              <Input
                label={p.fieldTitle}
                placeholder="Например: Скидка на выходные"
                lang="ru"
                value={titleRu}
                maxLength={TITLE_MAX + 20}
                error={fieldErrors.titleRu}
                hint={p.charCount(titleRu.trim().length, TITLE_MAX)}
                onChange={(e) => setTitleRu(e.target.value)}
              />
              <Textarea
                label={p.fieldBody}
                placeholder="Полный текст сообщения..."
                lang="ru"
                value={bodyRu}
                rows={4}
                error={fieldErrors.bodyRu}
                hint={p.charCount(bodyRu.trim().length, BODY_MAX)}
                onChange={(e) => setBodyRu(e.target.value)}
              />
            </div>

            {/* Kim OLADI va kim OLMAYDI — ikkalasi ham yozilgan. */}
            <RadioGroup
              name="audience"
              label={p.audience}
              options={AUDIENCES}
              value={audience}
              onChange={setAudience}
            />

            <p className="flex items-start gap-2 text-xs text-muted">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
              {p.warning}
            </p>
          </CardBody>
          <CardFooter>
            <Button onClick={openConfirm} leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
              {p.send}
            </Button>
          </CardFooter>
        </Card>

        <Card padding="none">
          <CardHeader title={p.history} divider />
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
              title={p.emptyTitle}
              description={p.emptyDesc}
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
                  {h.titleRu && (
                    <div className="mt-2 border-l-2 border-line pl-2" lang="ru">
                      <p className="text-[13px] font-medium text-ink">
                        <span className="mr-1.5 text-[11px] font-semibold text-subtle">RU</span>
                        {h.titleRu}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{h.bodyRu}</p>
                    </div>
                  )}
                  <p className="num mt-1.5 text-xs text-subtle">
                    {formatDateTime(h.createdAt, { withYear: true })} · {p.delivered(formatNumber(h.sentCount))}
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
        title={p.confirmTitle}
        description={
          <>
            {p.confirmPre}
            <strong className="text-ink">{selectedAudience.label.toLowerCase()}</strong>
            {p.confirmMid}
            {selectedAudience.description}
            {p.confirmPost}
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={sending}>
              {m.common.cancel}
            </Button>
            <Button isLoading={sending} onClick={handleSend} leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
              {p.sendTo(selectedAudience.label)}
            </Button>
          </>
        }
      >
        <div className="rounded-ds-md border border-line bg-surface-2 p-3">
          <p className="text-xs text-subtle">{p.preview}</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">{p.langUz}</p>
          <div className="mt-1 rounded-ds-sm border border-line bg-surface p-3">
            <p className="text-sm font-semibold text-ink">{title.trim()}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{body.trim()}</p>
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-subtle">{p.langRu}</p>
          {hasRu ? (
            <div className="mt-1 rounded-ds-sm border border-line bg-surface p-3" lang="ru">
              <p className="text-sm font-semibold text-ink">{titleRu.trim()}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{bodyRu.trim()}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">{p.ruFallback}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
