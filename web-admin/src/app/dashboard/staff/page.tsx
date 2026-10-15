'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { usersApi, User, Permission, ALL_PERMISSIONS } from '@/lib/api';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS_UZ,
  PERMISSION_SHORT_LABELS_UZ,
} from '@/lib/permission-labels';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { formatPhone, fullName } from '@/lib/format';

function PermissionSummary({ perms }: { perms: Permission[] }) {
  if (perms.length === 0) return <Badge variant="danger">Hech qanday ruxsat yo&apos;q</Badge>;
  if (perms.length === ALL_PERMISSIONS.length) return <Badge variant="success">To&apos;liq (barcha bo&apos;limlar)</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {perms.slice(0, 3).map((p) => (
        <Badge key={p} variant="neutral">
          {PERMISSION_SHORT_LABELS_UZ[p] ?? p}
        </Badge>
      ))}
      {perms.length > 3 && (
        <Badge
          variant="neutral"
          title={perms
            .slice(3)
            .map((p) => PERMISSION_SHORT_LABELS_UZ[p] ?? p)
            .join(', ')}
        >
          +{perms.length - 3}
        </Badge>
      )}
    </div>
  );
}

export default function StaffRolesPage() {
  const { toast } = useToast();
  const [managers, setManagers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getAll({ role: 'manager', limit: 100 });
      setManagers(res.data.data?.users ?? []);
      setError(null);
    } catch {
      // Last good rows stay on screen; DataTable shows banner + retry.
      setError("Xodimlarni yuklab bo'lmadi");
      toast({ title: 'Xatolik', description: 'Xodimlarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const filteredManagers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter((m) =>
      [fullName(m.firstName, m.lastName, ''), m.phone].join(' ').toLowerCase().includes(q)
    );
  }, [managers, search]);

  const openEdit = (user: User) => {
    setEditTarget(user);
    setDraftPermissions(user.permissions ?? []);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setDraftPermissions([]);
  };

  const togglePermission = (perm: Permission) => {
    setDraftPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const applyPreset = (preset: 'all' | 'dispatch-only' | 'none') => {
    if (preset === 'all') setDraftPermissions(ALL_PERMISSIONS);
    else if (preset === 'none') setDraftPermissions([]);
    else setDraftPermissions(['dispatch', 'drivers_view']);
  };

  // "Saqlash" is enabled only on a real change (dirty).
  const originalPermissions = editTarget?.permissions ?? [];
  const isDirty =
    draftPermissions.length !== originalPermissions.length ||
    draftPermissions.some((p) => !originalPermissions.includes(p));

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await usersApi.updatePermissions(editTarget.id, draftPermissions);
      setManagers((prev) =>
        prev.map((m) => (m.id === editTarget.id ? { ...m, permissions: draftPermissions } : m))
      );
      toast({
        title: 'Ruxsatlar yangilandi',
        description: `${fullName(editTarget.firstName, editTarget.lastName)} — ${draftPermissions.length} ta bo'limga kira oladi.`,
        variant: 'success',
      });
      closeEdit();
    } catch {
      toast({ title: 'Xatolik', description: 'Ruxsatlarni saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: 'Xodim',
      cell: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar firstName={u.firstName} lastName={u.lastName} size="sm" />
          <div className="min-w-0 leading-tight">
            <p className="font-medium text-ink truncate">{fullName(u.firstName, u.lastName)}</p>
            <p className="num text-xs text-muted whitespace-nowrap">{formatPhone(u.phone)}</p>
          </div>
        </div>
      ),
    },
    { key: 'perms', header: 'Ruxsatlar', cell: (u) => <PermissionSummary perms={u.permissions ?? []} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Amal</span>,
      align: 'right',
      cell: (u) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openEdit(u)}
          leftIcon={<ShieldCheck size={13} aria-hidden />}
        >
          Ruxsatlarni tahrirlash
        </Button>
      ),
    },
  ];

  const q = search.trim();

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Xodimlar va ruxsatlar"
        description="Har bir menejer qaysi bo'limlarga kira olishini belgilang — masalan, faqat dispetcherlik yoki to'liq boshqaruv"
      />

      <DataTable
        ariaLabel="Xodimlar"
        columns={columns}
        rows={filteredManagers}
        rowKey={(u) => u.id}
        loading={isLoading}
        error={error}
        onRetry={fetchManagers}
        maxHeightClassName="max-h-[calc(100vh-260px)]"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Ism yoki telefon…"
            searchAriaLabel="Xodimlarni qidirish"
          />
        }
        isFiltered={q !== ''}
        onClearFilters={() => setSearch('')}
        emptyFiltered={{ title: 'Hech narsa mos kelmadi', description: `"${q}" bo'yicha xodim topilmadi.` }}
        empty={{
          variant: 'first-use',
          icon: <Users aria-hidden />,
          title: 'Manager rolidagi hisoblar topilmadi',
          description:
            "Manager roli bilan hisob yaratilgach, u shu yerda ko'rinadi va ruxsatlarini shu yerdan belgilaysiz.",
        }}
      />

      <Modal
        isOpen={!!editTarget}
        onClose={closeEdit}
        size="lg"
        title={editTarget ? `${fullName(editTarget.firstName, editTarget.lastName)} — ruxsatlar` : 'Ruxsatlar'}
        description="ADMIN har doim hammasiga kira oladi — bu ro'yxat faqat MANAGER hisoblari uchun."
        footer={
          <>
            <p className="mr-auto num text-xs text-muted">
              Tanlangan: {draftPermissions.length} / {ALL_PERMISSIONS.length}
              {isDirty && <span className="ml-2 text-ink">· saqlanmagan</span>}
            </p>
            <Button variant="secondary" onClick={closeEdit} disabled={saving}>
              Bekor qilish
            </Button>
            <Button isLoading={saving} disabled={!isDirty} onClick={handleSave}>
              Saqlash
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant="secondary" onClick={() => applyPreset('all')}>
            Barchasi (to&apos;liq menejer)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => applyPreset('dispatch-only')}>
            Faqat dispetcherlik
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('none')}>
            Tozalash
          </Button>
        </div>

        {/* Permissions grouped by DOMAIN — the operator thinks "which section". */}
        <div className="space-y-4">
          {PERMISSION_GROUPS.map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-subtle">
                {group.title}
              </legend>
              <div className="rounded-ds-md border border-line divide-y divide-line">
                {group.permissions.map((perm) => {
                  const checked = draftPermissions.includes(perm);
                  return (
                    <div key={perm} className={cn('px-3 py-2', checked && 'bg-mint-tint/40')}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePermission(perm)}
                        label={PERMISSION_LABELS_UZ[perm]}
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </Modal>
    </div>
  );
}
