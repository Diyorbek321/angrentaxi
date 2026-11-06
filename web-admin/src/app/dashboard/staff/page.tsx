'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, Users } from 'lucide-react';
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
  permissionGroups,
  permissionLabels,
  permissionShortLabels,
} from '@/lib/permission-labels';
import { MONEY_OUT_PERMISSIONS, matchRoleTemplate, roleTemplates } from '@/lib/role-templates';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { formatPhone, fullName } from '@/lib/format';
import { t } from '@/locales';

function PermissionSummary({ perms }: { perms: Permission[] }) {
  const m = t().staff;
  if (perms.length === 0) return <Badge variant="danger">{m.noPermissions}</Badge>;
  // "To'liq" = every non-money permission; payout approval shows as its own badge.
  const hasMoneyOut = perms.some((p) => MONEY_OUT_PERMISSIONS.includes(p));
  const isFullManager = ALL_PERMISSIONS.every((p) => MONEY_OUT_PERMISSIONS.includes(p) || perms.includes(p));
  if (isFullManager) {
    return (
      <div className="flex flex-wrap gap-1">
        <Badge variant="success">{m.fullAccess}</Badge>
        {hasMoneyOut && <Badge variant="neutral">{permissionShortLabels().withdrawals_approve}</Badge>}
      </div>
    );
  }
  // Job-named role first: "Moliya" reads faster than five permission chips.
  const template = matchRoleTemplate(perms);
  if (template) {
    return (
      <Badge variant="neutral" title={perms.map((p) => permissionShortLabels()[p] ?? p).join(', ')}>
        {template.label}
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {perms.slice(0, 3).map((p) => (
        <Badge key={p} variant="neutral">
          {permissionShortLabels()[p] ?? p}
        </Badge>
      ))}
      {perms.length > 3 && (
        <Badge
          variant="neutral"
          title={perms
            .slice(3)
            .map((p) => permissionShortLabels()[p] ?? p)
            .join(', ')}
        >
          +{perms.length - 3}
        </Badge>
      )}
    </div>
  );
}

export default function StaffRolesPage() {
  const c = t().common;
  const m = t().staff;
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
      setError(m.loadFailed);
      toast({ title: c.error, description: m.loadError, variant: 'error' });
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
    return managers.filter((u) =>
      [fullName(u.firstName, u.lastName, ''), u.phone].join(' ').toLowerCase().includes(q)
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

  // "Barchasi" = to'liq menejer, lekin pul chiqarish emas: u faqat ataylab, alohida belgilanadi.
  const applyPreset = (preset: 'all' | 'none') => {
    setDraftPermissions(
      preset === 'all' ? ALL_PERMISSIONS.filter((p) => !MONEY_OUT_PERMISSIONS.includes(p)) : []
    );
  };

  const activeTemplate = matchRoleTemplate(draftPermissions);
  const grantsMoneyOut = draftPermissions.some((p) => MONEY_OUT_PERMISSIONS.includes(p));

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
        prev.map((u) => (u.id === editTarget.id ? { ...u, permissions: draftPermissions } : u))
      );
      toast({
        title: m.updated,
        description: m.updatedDesc(fullName(editTarget.firstName, editTarget.lastName), draftPermissions.length),
        variant: 'success',
      });
      closeEdit();
    } catch {
      toast({ title: c.error, description: m.saveError, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: m.colStaff,
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
    { key: 'perms', header: m.colPermissions, cell: (u) => <PermissionSummary perms={u.permissions ?? []} /> },
    {
      key: 'actions',
      header: <span className="sr-only">{c.action}</span>,
      align: 'right',
      cell: (u) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openEdit(u)}
          leftIcon={<ShieldCheck size={13} aria-hidden />}
        >
          {m.editPermissions}
        </Button>
      ),
    },
  ];

  const q = search.trim();

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={m.title}
        description={m.description}
      />

      <DataTable
        ariaLabel={m.tableAria}
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
            searchPlaceholder={m.searchPlaceholder}
            searchAriaLabel={m.searchAria}
          />
        }
        isFiltered={q !== ''}
        onClearFilters={() => setSearch('')}
        emptyFiltered={{ title: m.emptyFilteredTitle, description: m.emptyFilteredDesc(q) }}
        empty={{
          variant: 'first-use',
          icon: <Users aria-hidden />,
          title: m.emptyTitle,
          description: m.emptyDesc,
        }}
      />

      <Modal
        isOpen={!!editTarget}
        onClose={closeEdit}
        size="lg"
        title={editTarget ? m.modalTitle(fullName(editTarget.firstName, editTarget.lastName)) : m.colPermissions}
        description={m.modalDesc}
        footer={
          <>
            <p className="mr-auto num text-xs text-muted">
              {m.selected(draftPermissions.length, ALL_PERMISSIONS.length)}
              {isDirty && <span className="ml-2 text-ink">{m.unsaved}</span>}
            </p>
            <Button variant="secondary" onClick={closeEdit} disabled={saving}>
              {c.cancel}
            </Button>
            <Button isLoading={saving} disabled={!isDirty} onClick={handleSave}>
              {c.save}
            </Button>
          </>
        }
      >
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-subtle">
          {m.templatesLabel}
          <span className="ml-2 normal-case tracking-normal font-normal text-muted">
            {activeTemplate ? activeTemplate.label : draftPermissions.length > 0 ? m.customRole : ''}
          </span>
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {roleTemplates().map((tpl) => (
            <Button
              key={tpl.id}
              size="sm"
              variant={activeTemplate?.id === tpl.id ? 'primary' : 'secondary'}
              aria-pressed={activeTemplate?.id === tpl.id}
              title={tpl.description}
              onClick={() => setDraftPermissions([...tpl.permissions])}
            >
              {tpl.label}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => applyPreset('all')}>
            {m.presetAll}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('none')}>
            {m.presetClear}
          </Button>
        </div>

        {grantsMoneyOut && (
          <div
            role="note"
            className="mb-4 flex items-start gap-2 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2 text-[13px] text-danger-dark dark:text-danger-light"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>{m.moneyOutWarning}</span>
          </div>
        )}

        {/* Permissions grouped by DOMAIN — the operator thinks "which section". */}
        <div className="space-y-4">
          {permissionGroups().map((group) => (
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
                        label={permissionLabels()[perm]}
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
