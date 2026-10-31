'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Sparkles } from 'lucide-react';
import { Badge, Button, DataTable, IconButton, Input, Modal, Switch, useToast, type DataTableColumn } from '@/components/ui';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { intercityApi } from '@/lib/intercity-api';
import {
  INTERCITY_ZONE_RADIUS_MAX_KM,
  INTERCITY_ZONE_RADIUS_MIN_KM,
  presetZonesToCreate,
  validateZoneForm,
  type FormErrors,
  type IntercityPoint,
  type IntercityZone,
  type IntercityZoneForm,
} from '@/lib/intercity';
import { t } from '@/locales';

interface PointZonesModalProps {
  open: boolean;
  point: IntercityPoint | null;
  onClose: () => void;
}

/** Maydonlar satr holida — "41," yozilayotganda NaN bo'lib qolmasin. */
interface Draft {
  name: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
}

const EMPTY: Draft = { name: '', centerLat: '', centerLng: '', radiusKm: '4' };

const toForm = (draft: Draft): IntercityZoneForm => ({
  name: draft.name.trim(),
  centerLat: Number(draft.centerLat),
  centerLng: Number(draft.centerLng),
  radiusKm: Number(draft.radiusKm),
});

/**
 * Nuqta tumanlari (Yunusobod, Chilonzor…). Haydovchi qatnov eʼlon qilganda
 * shulardan tanlaydi — boshqa tumandagi yoʻlovchi bu qatnovni band qila olmaydi,
 * mashina shaharning qarama-qarshi chekkalariga tarqalib ketmaydi.
 */
export function PointZonesModal({ open, point, onClose }: PointZonesModalProps) {
  const m = t();
  const zm = m.intercity.zones;
  const fm = m.intercity.pointForm;
  const { toast } = useToast();
  const [zones, setZones] = useState<IntercityZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<IntercityZone | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<FormErrors<IntercityZoneForm>>({});
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!point) return;
    setLoading(true);
    try {
      const res = await intercityApi.getZones(point.id);
      setZones(res.data.data);
      setLoadError(null);
    } catch {
      setLoadError(t().intercity.zones.loadError);
    } finally {
      setLoading(false);
    }
  }, [point]);

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setDraft(EMPTY);
    setErrors({});
    void load();
  }, [open, load]);

  const startEdit = (zone: IntercityZone) => {
    setEditing(zone);
    setErrors({});
    setDraft({
      name: zone.name,
      centerLat: String(zone.centerLat),
      centerLng: String(zone.centerLng),
      radiusKm: String(zone.radiusKm),
    });
  };

  const update = (key: keyof Draft, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (errors[key]) setErrors(validateZoneForm(toForm(next)));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!point) return;
    const form = toForm(draft);
    const found = validateZoneForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      if (editing) {
        await intercityApi.updateZone(editing.id, form);
        toast({ title: zm.updated, variant: 'success' });
      } else {
        await intercityApi.createZone(point.id, { ...form, sortOrder: zones.length });
        toast({ title: zm.added, variant: 'success' });
      }
      setEditing(null);
      setDraft(EMPTY);
      await load();
    } catch (err) {
      toast({
        title: apiErrorTitle(err, fm.saveFailed),
        description: apiErrorMessage(err, zm.saveError),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  /** Tayyor roʻyxat: borlari tegilmaydi, yoʻqlari ketma-ket yaratiladi. */
  const seedPreset = async () => {
    if (!point) return;
    const missing = presetZonesToCreate(zones);
    if (missing.length === 0) {
      toast({ title: zm.allExist, variant: 'success' });
      return;
    }
    setSeeding(true);
    let created = 0;
    try {
      for (const zone of missing) {
        await intercityApi.createZone(point.id, zone);
        created += 1;
      }
      toast({
        title: zm.seeded(created),
        description: zm.seededHint,
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: apiErrorTitle(err, zm.seedPartial(created)),
        description: apiErrorMessage(err, zm.seedError),
        variant: 'error',
      });
    } finally {
      setSeeding(false);
      await load();
    }
  };

  const toggle = async (zone: IntercityZone) => {
    setTogglingId(zone.id);
    try {
      const res = await intercityApi.updateZone(zone.id, { isActive: !zone.isActive });
      setZones((prev) => prev.map((z) => (z.id === zone.id ? res.data.data : z)));
    } catch (err) {
      toast({
        title: apiErrorTitle(err, m.common.error),
        description: apiErrorMessage(err, m.common.statusChangeFailedAlt),
        variant: 'error',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const columns: DataTableColumn<IntercityZone>[] = [
    {
      key: 'name',
      header: zm.colZone,
      cell: (z) => <span className={z.isActive ? 'font-medium text-ink' : 'font-medium text-muted'}>{z.name}</span>,
    },
    {
      key: 'status',
      header: m.common.statusAlt,
      cell: (z) => (
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={z.isActive}
            disabled={togglingId === z.id}
            onCheckedChange={() => void toggle(z)}
            aria-label={`${z.name}: ${z.isActive ? m.intercity.page.deactivate : m.intercity.page.activate}`}
          />
          <Badge variant={z.isActive ? 'success' : 'neutral'}>{z.isActive ? m.common.active : m.common.inactive}</Badge>
        </div>
      ),
    },
    {
      key: 'coords',
      header: m.intercity.page.colCenter,
      hideBelow: 'md',
      className: 'num whitespace-nowrap text-muted',
      cell: (z) => `${z.centerLat.toFixed(4)}, ${z.centerLng.toFixed(4)}`,
    },
    { key: 'radius', header: m.intercity.page.colRadius, numeric: true, cell: (z) => `${z.radiusKm} km` },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      width: 'w-12',
      cell: (z) => (
        <IconButton size="sm" aria-label={zm.edit(z.name)} onClick={() => startEdit(z)}>
          <Pencil aria-hidden />
        </IconButton>
      ),
    },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={point ? zm.titleFor(point.name) : zm.title}
      description={zm.description}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {m.common.close}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{zones.length > 0 ? zm.count(zones.length) : zm.none}</p>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            isLoading={seeding}
            disabled={loading || Boolean(loadError)}
            onClick={() => void seedPreset()}
          >
            {zm.preset}
          </Button>
        </div>

        <DataTable
          ariaLabel={zm.tableAria}
          columns={columns}
          rows={zones}
          rowKey={(z) => z.id}
          loading={loading}
          error={loadError}
          onRetry={load}
          rowClassName={(z) => (z.isActive ? undefined : 'bg-surface-2/40')}
          empty={{
            variant: 'first-use',
            title: zm.empty,
            description: zm.emptyHint,
          }}
        />

        <form onSubmit={save} className="space-y-3 rounded-ds-sm border border-line bg-surface-2 p-3" noValidate>
          <p className="text-sm font-medium text-ink">{editing ? zm.editing(editing.name) : zm.newZone}</p>
          <Input
            label={fm.name}
            placeholder="Yunusobod"
            value={draft.name}
            error={errors.name}
            onChange={(e) => update('name', e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label={fm.lat}
              inputMode="decimal"
              className="num"
              placeholder="41.365"
              value={draft.centerLat}
              error={errors.centerLat}
              onChange={(e) => update('centerLat', e.target.value)}
            />
            <Input
              label={fm.lng}
              inputMode="decimal"
              className="num"
              placeholder="69.288"
              value={draft.centerLng}
              error={errors.centerLng}
              onChange={(e) => update('centerLng', e.target.value)}
            />
            <Input
              label={fm.radius}
              type="number"
              inputMode="decimal"
              min={INTERCITY_ZONE_RADIUS_MIN_KM}
              max={INTERCITY_ZONE_RADIUS_MAX_KM}
              step={0.5}
              value={draft.radiusKm}
              error={errors.radiusKm}
              onChange={(e) => update('radiusKm', e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editing ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDraft(EMPTY);
                  setErrors({});
                }}
              >
                {m.common.cancel}
              </Button>
            ) : null}
            <Button type="submit" size="sm" isLoading={saving}>
              {editing ? m.common.save : m.common.add}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
