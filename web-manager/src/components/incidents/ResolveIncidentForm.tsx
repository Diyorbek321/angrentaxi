'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { resolveIncident } from '@/lib/incidents-api';
import {
  MONEY_OUTCOMES,
  OUTCOME_TYPES,
  buildResolvePayload,
  emptyOutcome,
  isPendingAppeal,
  suggestedOutcome,
  type IncidentDetail,
  type IncidentOutcomeType,
  type OutcomeDraft,
  type ResolveDraft,
} from '@/lib/incidents';
import { apiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Textarea } from '@/components/ui/Textarea';
import { DetailCard } from '@/components/ui/KeyValue';
import { useToast } from '@/components/ui/Toast';
import { t } from '@/locales';

interface Props {
  incident: IncidentDetail;
  isAdmin: boolean;
  onResolved: () => void;
}

/**
 * Qaror formasi: izoh majburiy, natijalar bir nechta (INCIDENT-POLICY §3).
 * Zinapoya taklifi bir bosishda qo'shiladi; blok faqat adminga ko'rinadi.
 */
export function ResolveIncidentForm({ incident, isAdmin, onResolved }: Props) {
  const m = t().incidents;
  const f = m.form;
  const { toast } = useToast();
  const pendingAppeal = isPendingAppeal(incident);
  const [draft, setDraft] = useState<ResolveDraft>({
    status: 'resolved',
    note: '',
    confirmedAgainstSubject: incident.subjectUserId != null,
    outcomes: [],
    appealDecision: null,
  });
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const adminLocked = (incident.escalatedToAdmin || pendingAppeal) && !isAdmin;
  const available = OUTCOME_TYPES.filter(
    (type) => (isAdmin || type !== 'block') && !draft.outcomes.some((o) => o.type === type),
  );
  const suggestion = incident.strikes ? suggestedOutcome(incident.strikes.suggestion) : null;

  const setOutcome = (index: number, patch: Partial<OutcomeDraft>) =>
    setDraft((d) => ({ ...d, outcomes: d.outcomes.map((o, i) => (i === index ? { ...o, ...patch } : o)) }));
  const addOutcome = (type: IncidentOutcomeType) =>
    setDraft((d) => (d.outcomes.some((o) => o.type === type) ? d : { ...d, outcomes: [...d.outcomes, emptyOutcome(type)] }));
  const removeOutcome = (index: number) =>
    setDraft((d) => ({ ...d, outcomes: d.outcomes.filter((_, i) => i !== index) }));

  const submit = async () => {
    const { payload, problems: found } = buildResolvePayload(draft, { pendingAppeal, isAdmin });
    setProblems(found.map((p) => f.problems[p] ?? p));
    if (!payload) return;
    setSaving(true);
    try {
      await resolveIncident(incident.id, payload);
      toast({ title: f.saved, variant: 'success' });
      onResolved();
    } catch (err) {
      toast({ title: apiErrorMessage(err, f.saveFailed), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (adminLocked) {
    return (
      <DetailCard title={f.title}>
        <p className="text-sm text-muted">{f.adminOnly}</p>
      </DetailCard>
    );
  }

  return (
    <DetailCard title={f.title}>
      <div className="flex flex-col gap-3">
        <SegmentedControl
          items={[
            { value: 'resolved' as const, label: f.resolved },
            { value: 'rejected' as const, label: f.rejected },
          ]}
          value={draft.status}
          onChange={(status) => setDraft((d) => ({ ...d, status }))}
          ariaLabel={f.title}
        />

        {pendingAppeal && (
          <Select
            label={f.appealDecision}
            value={draft.appealDecision ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, appealDecision: (e.target.value || null) as ResolveDraft['appealDecision'] }))}
            options={[
              { value: '', label: '—' },
              { value: 'upheld', label: f.upheld },
              { value: 'overturned', label: f.overturned },
            ]}
          />
        )}

        <Textarea
          label={f.note}
          required
          rows={3}
          maxLength={1000}
          placeholder={f.notePlaceholder}
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        />

        {draft.status === 'resolved' && (
          <>
            {incident.subjectUserId && (
              <Checkbox
                checked={draft.confirmedAgainstSubject}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, confirmedAgainstSubject: checked }))}
                label={f.confirmed}
              />
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{f.outcomes}</span>
                {suggestion && !draft.outcomes.some((o) => o.type === suggestion) && (
                  <Button variant="secondary" size="sm" onClick={() => addOutcome(suggestion)}>
                    {m.detail.addSuggested}: {m.outcomes[suggestion]}
                  </Button>
                )}
              </div>
              {draft.outcomes.map((o, index) => (
                <div key={o.type} className="flex flex-wrap items-end gap-2 rounded-ds-sm border border-line p-2">
                  <span className="min-w-[150px] text-sm font-medium">{m.outcomes[o.type]}</span>
                  {MONEY_OUTCOMES.includes(o.type) && (
                    <div className="w-36">
                      <Input label={f.amount} inputMode="numeric" value={o.amount} onChange={(e) => setOutcome(index, { amount: e.target.value })} />
                    </div>
                  )}
                  {o.type === 'refund' && (incident.orderVertical === 'food' || incident.orderVertical === 'market') && (
                    <div className="w-56">
                      <Select
                        label={f.refundMethod}
                        value={o.refundMethod}
                        onChange={(e) => setOutcome(index, { refundMethod: e.target.value as 'wallet' | 'card' })}
                        options={[
                          { value: 'wallet', label: f.wallet },
                          { value: 'card', label: f.card },
                        ]}
                      />
                    </div>
                  )}
                  {o.type === 'suspension' && (
                    <div className="w-44">
                      <Input label={f.days} inputMode="numeric" value={o.days} onChange={(e) => setOutcome(index, { days: e.target.value })} />
                    </div>
                  )}
                  <Button variant="ghost" size="sm" aria-label={f.remove} onClick={() => removeOutcome(index)}>
                    <X size={14} aria-hidden />
                  </Button>
                </div>
              ))}
              {available.length > 0 && (
                <div className="w-64">
                  <Select
                    aria-label={f.addOutcome}
                    value=""
                    onChange={(e) => e.target.value && addOutcome(e.target.value as IncidentOutcomeType)}
                    options={[
                      { value: '', label: `+ ${f.addOutcome}` },
                      ...available.map((type) => ({ value: type, label: m.outcomes[type] })),
                    ]}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {problems.length > 0 && (
          <ul className="text-sm text-danger" role="alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button onClick={() => void submit()} isLoading={saving} leftIcon={<Plus size={14} aria-hidden />}>
            {f.submit}
          </Button>
        </div>
      </div>
    </DetailCard>
  );
}
